import { useRef } from 'react'
import { FileText } from 'lucide-react'

/**
 * Bouton « Télécharger PDF » réutilisable. Capture le contenu d'un élément
 * HTML au format A4 via html2pdf.js (déjà utilisé par les bulletins).
 *
 * Le PDF généré porte un en-tête propre avec UNIQUEMENT le nom du document
 * (prop `title`, sinon dérivé de `filename`). Les contrôles interactifs de la
 * page (boutons, listes déroulantes, champs) et le titre d'origine de la page
 * sont retirés de la capture afin que le fichier ne contienne pas l'en-tête
 * de la plateforme.
 *
 * Usage :
 *   <DownloadPdfButton
 *     containerRef={ref}              // Ref vers le conteneur DOM à capturer
 *     filename="emploi-du-temps.pdf"  // Nom du fichier téléchargé
 *     title="Emploi du temps"         // En-tête affiché dans le PDF
 *     label="Emploi du temps PDF"
 *     iconOnly                        // rend un petit bouton icône (mobile)
 *   />
 */

// Dérive un titre lisible depuis un nom de fichier (« emploi-du-temps.pdf » → « Emploi du temps »)
function titleFromFilename(filename = '') {
  const base = filename.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim()
  if (!base) return 'Document'
  return base.charAt(0).toUpperCase() + base.slice(1)
}

export default function DownloadPdfButton({ containerRef, filename = 'document.pdf', title, subtitle = '', label = 'Télécharger PDF', iconOnly = false, className = '' }) {
  const busyRef = useRef(false)

  const docTitle = title || titleFromFilename(filename)

  const download = async () => {
    if (busyRef.current || !containerRef?.current) return
    busyRef.current = true

    let wrapper
    try {
      // Chargement dynamique de html2pdf.js pour ne pas alourdir le bundle initial
      const html2pdf = (await import('html2pdf.js')).default

      const source = containerRef.current

      // Clone : on ne modifie jamais le DOM affiché à l'utilisateur
      const clone = source.cloneNode(true)
      // Retire les contrôles interactifs et tout ce qui est marqué « non imprimable »
      clone.querySelectorAll('button, select, input, textarea, [data-no-pdf], .no-pdf').forEach((el) => el.remove())
      // Retire le ou les titres d'origine de la page (remplacés par l'en-tête propre)
      clone.querySelectorAll('h1').forEach((el) => el.remove())

      // En-tête propre : uniquement le nom du document
      const header = document.createElement('div')
      header.style.cssText = 'border-bottom:2px solid #2563EB;padding-bottom:10px;margin-bottom:16px;font-family:Arial,Helvetica,sans-serif'
      header.innerHTML = `
        <h1 style="font-size:22px;font-weight:800;color:#111827;margin:0;letter-spacing:-0.01em">${docTitle}</h1>
        ${subtitle ? `<p style="font-size:12px;color:#6B7280;margin:6px 0 0">${subtitle}</p>` : ''}
      `

      wrapper = document.createElement('div')
      wrapper.style.cssText = `background:#ffffff;padding:4px;position:fixed;left:0;top:0;z-index:-1;pointer-events:none;width:${source.offsetWidth || 800}px`
      wrapper.appendChild(header)
      wrapper.appendChild(clone)
      document.body.appendChild(wrapper)

      const opt = {
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0, windowWidth: document.documentElement.scrollWidth },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pageBreak: { mode: ['avoid-all', 'css', 'legacy'] },
      }
      await html2pdf().set(opt).from(wrapper).save()
    } catch (err) {
      // Les erreurs d'import sont généralement fatales (réseau offline…)
      if (!(err instanceof TypeError)) console.error('Erreur PDF:', err)
    } finally {
      if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper)
      busyRef.current = false
    }
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