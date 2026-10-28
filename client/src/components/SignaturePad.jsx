// client/src/components/SignaturePad.jsx — Composant de signature numérique tactile au doigt / stylet / souris
import { useRef, useState, useEffect, useCallback } from 'react'
import { RotateCcw, Check, PenTool } from 'lucide-react'

export default function SignaturePad({
  title = 'Signature',
  label,
  subtitle = 'Signez avec votre doigt ou stylet dans le cadre ci-dessous',
  onSave,
  onChange,
  value,
  required = true,
}) {
  const displayTitle = label || title
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  // Configure la taille et les propriétés de tracé du canvas
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(280, rect.width || canvas.offsetWidth || 360)
    const h = Math.max(110, rect.height || canvas.offsetHeight || 130)

    // Ajuste les dimensions physiques et logiques si nécessaire
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.8
    ctx.strokeStyle = '#0f172a' // Noir bleuté élégant KATD
  }, [])

  useEffect(() => {
    // Initialise après un tick pour laisser les modales et animations CSS se stabiliser
    const timer = setTimeout(setupCanvas, 60)
    window.addEventListener('resize', setupCanvas)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', setupCanvas)
    }
  }, [setupCanvas])

  // Obtient les coordonnées relatives précises par rapport au canvas
  const getPoint = (clientX, clientY) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  const startDraw = (clientX, clientY) => {
    setupCanvas()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    isDrawing.current = true
    const { x, y } = getPoint(clientX, clientY)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const drawMove = (clientX, clientY) => {
    if (!isDrawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y } = getPoint(clientX, clientY)
    ctx.lineTo(x, y)
    ctx.stroke()

    if (!hasDrawn) {
      setHasDrawn(true)
    }
  }

  const endDraw = () => {
    if (!isDrawing.current) return
    isDrawing.current = false
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      const dataUrl = canvas.toDataURL('image/png')
      if (onSave) onSave(dataUrl)
      if (onChange) onChange(dataUrl)
    } catch (_) {}
  }

  // Gestionnaires tactiles natifs (Mobile / Tablette au doigt)
  const handleTouchStart = (e) => {
    e.preventDefault()
    if (e.touches && e.touches[0]) {
      startDraw(e.touches[0].clientX, e.touches[0].clientY)
    }
  }

  const handleTouchMove = (e) => {
    e.preventDefault()
    if (e.touches && e.touches[0]) {
      drawMove(e.touches[0].clientX, e.touches[0].clientY)
    }
  }

  const handleTouchEnd = (e) => {
    e.preventDefault()
    endDraw()
  }

  // Gestionnaires souris / pointer (Desktop)
  const handleMouseDown = (e) => {
    e.preventDefault()
    startDraw(e.clientX, e.clientY)
  }

  const handleMouseMove = (e) => {
    if (isDrawing.current) {
      e.preventDefault()
      drawMove(e.clientX, e.clientY)
    }
  }

  const handleMouseUp = (e) => {
    e.preventDefault()
    endDraw()
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    setHasDrawn(false)
    if (onSave) onSave('')
    if (onChange) onChange('')
    setupCanvas()
  }

  return (
    <div className="space-y-1.5 w-full select-none">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
            <PenTool size={13} className="text-emerald-600" />
            <span>{displayTitle}</span>
            {required && <span className="text-red-500">*</span>}
          </label>
          {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
        </div>
        {hasDrawn && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-rose-50 transition-colors bg-white border border-rose-200 shadow-2xs"
          >
            <RotateCcw size={12} /> Effacer pour recommencer
          </button>
        )}
      </div>

      <div className="relative rounded-2xl border-2 border-dashed border-gray-300 hover:border-emerald-500 bg-white shadow-2xs overflow-hidden transition-all focus-within:ring-2 focus-within:ring-emerald-500/20">
        <canvas
          ref={canvasRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full h-28 touch-none cursor-crosshair bg-slate-50/50 block"
          style={{ touchAction: 'none' }}
        />

        {!hasDrawn && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-gray-400 text-xs gap-2 select-none opacity-70">
            <PenTool size={16} className="text-amber-600 animate-pulse" />
            <span className="font-medium">Apposez votre signature numérique ici (au doigt)</span>
          </div>
        )}

        {hasDrawn && (
          <div className="absolute bottom-1.5 right-2 pointer-events-none text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300 shadow-xs">
            <Check size={12} className="text-emerald-600" /> Signature numérique prête
          </div>
        )}
      </div>
    </div>
  )
}
