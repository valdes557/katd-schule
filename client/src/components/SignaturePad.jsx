// client/src/components/SignaturePad.jsx — Composant de signature numérique tactile au doigt / stylet / souris
import { useRef, useState, useEffect } from 'react'
import { RotateCcw, Check, PenTool } from 'lucide-react'

export default function SignaturePad({
  title = 'Signature',
  subtitle = 'Signez avec votre doigt ou stylet dans le cadre ci-dessous',
  onSave,
  required = true,
}) {
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  // Initialisation et adaptation haute résolution (Retina / Mobile)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // Ajuste la résolution interne du canvas par rapport à son affichage CSS
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    ctx.strokeStyle = '#0f172a' // Bleu nuit élégant
  }, [])

  const getCoordinates = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const handlePointerDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    isDrawing.current = true
    const { x, y } = getCoordinates(e)
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const handlePointerMove = (e) => {
    if (!isDrawing.current) return
    e.preventDefault()
    e.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return
    const { x, y } = getCoordinates(e)
    const ctx = canvas.getContext('2d')
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasDrawn) {
      setHasDrawn(true)
    }
  }

  const handlePointerUp = (e) => {
    if (!isDrawing.current) return
    e.preventDefault()
    e.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      canvas.releasePointerCapture(e.pointerId)
    } catch (_) {}
    isDrawing.current = false

    // Émet l'image PNG en base64 au parent
    if (onSave) {
      const dataUrl = canvas.toDataURL('image/png')
      onSave(dataUrl)
    }
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    setHasDrawn(false)
    if (onSave) onSave('')
  }

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
            <PenTool size={13} className="text-emerald-600" />
            <span>{title}</span>
            {required && <span className="text-red-500">*</span>}
          </label>
          {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
        </div>
        {hasDrawn && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-rose-50 transition-colors"
          >
            <RotateCcw size={12} /> Effacer
          </button>
        )}
      </div>

      <div className="relative rounded-2xl border-2 border-dashed border-gray-300 hover:border-emerald-500 bg-white shadow-2xs overflow-hidden transition-all focus-within:ring-2 focus-within:ring-emerald-500/20">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-28 touch-none cursor-crosshair bg-slate-50/50"
          style={{ touchAction: 'none' }}
        />

        {!hasDrawn && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-gray-400 text-xs gap-1.5 select-none opacity-60">
            <PenTool size={14} />
            <span>Apposez votre signature ici (au doigt)</span>
          </div>
        )}

        {hasDrawn && (
          <div className="absolute bottom-1.5 right-2 pointer-events-none text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
            <Check size={11} /> Signature enregistrée
          </div>
        )}
      </div>
    </div>
  )
}
