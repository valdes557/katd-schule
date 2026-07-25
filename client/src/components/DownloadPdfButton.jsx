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

// Attend le chargement (ou l'échec) de toutes les images d'un conteneur avant de
// lancer la capture — sinon html2canvas fige un rendu partiel/vide (« page vide »).
function waitForImages(root, timeout = 4000) {
  const imgs = Array.from(root.querySelectorAll('img'))
  const pending = imgs.filter((im) => !im.complete || im.naturalWidth === 0)
  if (!pending.length) return Promise.resolve()
  return new Promise((resolve) => {
    let done = 0
    const finish = () => { if (++done >= pending.length) resolve() }
    pending.forEach((im) => {
      im.addEventListener('load', finish, { once: true })
      im.addEventListener('error', finish, { once: true })
    })
    // Filet de sécurité : on ne bloque jamais plus que `timeout`.
    setTimeout(resolve, timeout)
  })
}

export default function DownloadPdfButton({ containerRef, filename = 'document.pdf', title, subtitle = '', label = 'Télécharger PDF', iconOnly = false, className = '' }) {
  const busyRef = useRef(false)

  const docTitle = title || titleFromFilename(filename)

  const download = async () => {
    if (busyRef.current || !containerRef?.current) return
    busyRef.current = true

    let wrapper, overlay
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

      // Neutralise les animations d'apparition (ex. `animate-fade-in`, opacity 0→1).
      // Rejouées sur le clone, elles pouvaient être capturées en plein fondu par
      // html2canvas → PDF vide de façon intermittente.
      clone.style.animation = 'none'
      clone.style.opacity = '1'
      clone.style.transform = 'none'
      clone.querySelectorAll('[class*="animate-"]').forEach((el) => {
        el.style.animation = 'none'
        el.style.opacity = '1'
        el.style.transform = 'none'
      })

      // En-tête propre : uniquement le nom du document
      const header = document.createElement('div')
      header.style.cssText = 'border-bottom:2px solid #2563EB;padding-bottom:10px;margin-bottom:16px;font-family:Arial,Helvetica,sans-serif'
      header.innerHTML = `
        <h1 style="font-size:22px;font-weight:800;color:#111827;margin:0;letter-spacing:-0.01em">${docTitle}</h1>
        ${subtitle ? `<p style="font-size:12px;color:#6B7280;margin:6px 0 0">${subtitle}</p>` : ''}
      `

      // IMPORTANT : le clone est rendu RÉELLEMENT DANS LE VIEWPORT (position:fixed en
      // haut-gauche), comme le bulletin qui fonctionne. Le rendre hors écran
      // (left:-100000px) ou en z-index négatif faisait produire à html2canvas une
      // capture VIDE sur certains appareils. Pour éviter tout clignotement visible,
      // on le masque derrière un overlay blanc opaque (élément séparé, donc NON
      // capturé) affichant « Génération du PDF… ».
      const width = source.offsetWidth || 800
      wrapper = document.createElement('div')
      wrapper.style.cssText = `position:fixed;left:0;top:0;z-index:2147483646;background:#ffffff;padding:16px;width:${width}px`
      wrapper.appendChild(header)
      wrapper.appendChild(clone)
      document.body.appendChild(wrapper)

      overlay = document.createElement('div')
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#ffffff;display:flex;align-items:center;justify-content:center;color:#2563EB;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600'
      overlay.textContent = 'Génération du PDF…'
      document.body.appendChild(overlay)

      // Attend le chargement des images du clone avant de capturer (évite le vide).
      await waitForImages(wrapper, 4000)

      const opt = {
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        // Options minimales identiques aux bulletins (qui fonctionnent). scale:2 pour
        // la netteté, useCORS pour les images distantes (Cloudinary), fond blanc.
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pageBreak: { mode: ['avoid-all', 'css', 'legacy'] },
      }

      // Génère le PDF en Blob puis déclenche un vrai téléchargement (fiable sur
      // mobile et desktop), avec repli sur le save() intégré si besoin.
      const worker = html2pdf().set(opt).from(wrapper)
      try {
        const blob = await worker.outputPdf('blob')
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 2000)
      } catch {
        await html2pdf().set(opt).from(wrapper).save()
      }
    } catch (err) {
      // Les erreurs d'import sont généralement fatales (réseau offline…)
      if (!(err instanceof TypeError)) console.error('Erreur PDF:', err)
    } finally {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay)
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