import { useRef } from 'react'
import { FileText } from 'lucide-react'

/**
 * Bouton « Télécharger PDF » réutilisable. Capture le contenu d'un élément
 * HTML au format A4 via html2pdf.js (déjà utilisé par les bulletins).
 *
 * Usage :
 *   <DownloadPdfButton
 *     containerRef={ref}       // Ref vers le conteneur DOM à capturer
 *     filename="rapport.pdf"
 *     label="Télécharger PDF"
 *     iconOnly                 // rend un petit bouton icône (mobile)
 *   />
 */
export default function DownloadPdfButton({ containerRef, filename = 'document.pdf', label = 'Télécharger PDF', iconOnly = false, className = '' }) {
  const busyRef = useRef(false)

  const download = async () => {
    if (busyRef.current || !containerRef?.current) return
    busyRef.current = true
    try {
      // Chargement dynamique de html2pdf.js pour ne pas alourdir le bundle initial
      const html2pdf = (await import('html2pdf.js')).default
      const opt = {
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pageBreak: { mode: ['avoid-all', 'css', 'legacy'] },
      }
      await html2pdf().set(opt).from(containerRef.current).save()
    } catch (err) {
      // Les erreurs d'import sont généralement fatales (réseau offline…)
      if (!(err instanceof TypeError)) console.error('Erreur PDF:', err)
    }
    busyRef.current = false
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={download}
        title={label}
        className={`p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 ${className}`}
      >
        <FileText size={15} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={download}
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors ${className}`}
    >
      <FileText size={13} /> {label}
    </button>
  )
}
