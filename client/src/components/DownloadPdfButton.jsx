import { useRef, useState } from 'react'
import { Download } from 'lucide-react'

/**
 * Bouton « Télécharger (PDF) » réutilisable — MÊME méthode et MÊME apparence que
 * les bulletins (qui fonctionnent de façon fiable).
 *
 * Principe clé : on capture l'élément RÉELLEMENT AFFICHÉ à l'écran (comme le
 * bulletin), sans clone hors-écran. Le clonage hors-écran produisait des PDF
 * vides sur beaucoup d'appareils. Pendant la capture, on masque brièvement les
 * contrôles interactifs (boutons, listes, champs) et on insère un en-tête propre
 * dans le DOM vivant ; le tout est caché derrière un overlay blanc « Génération
 * du PDF… » pour éviter tout clignotement, puis restauré à l'identique.
 *
 * Usage :
 *   <DownloadPdfButton
 *     containerRef={ref}              // Ref vers le conteneur DOM à capturer
 *     filename="emploi-du-temps.pdf"  // Nom du fichier téléchargé
 *     title="Emploi du temps"         // En-tête affiché dans le PDF
 *     subtitle="6e A — Primaire"      // Sous-titre optionnel de l'en-tête
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

export default function DownloadPdfButton({ containerRef, filename = 'document.pdf', title, subtitle = '', label = 'Télécharger (PDF)', className = '' }) {
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)

  const docTitle = title || titleFromFilename(filename)

  const download = async () => {
    if (busyRef.current || !containerRef?.current) return
    busyRef.current = true
    setBusy(true)

    const source = containerRef.current

    // On masque brièvement les éléments non imprimables et les titres d'origine,
    // et on insère un en-tête propre — le tout DANS le DOM vivant. On mémorise les
    // valeurs d'origine pour tout restaurer ensuite (aucune trace pour l'utilisateur).
    const hidden = []
    const hide = (el) => { hidden.push([el, el.style.display]); el.style.display = 'none' }
    source.querySelectorAll('button, select, input, textarea, [data-no-pdf], .no-pdf').forEach(hide)
    source.querySelectorAll('h1').forEach(hide)

    // En-tête propre : uniquement le nom du document (inséré en tête du conteneur).
    const header = document.createElement('div')
    header.setAttribute('data-pdf-header', '1')
    header.style.cssText = 'border-bottom:2px solid #2563EB;padding-bottom:10px;margin-bottom:16px;font-family:Arial,Helvetica,sans-serif'
    header.innerHTML = `
      <h1 style="font-size:22px;font-weight:800;color:#111827;margin:0;letter-spacing:-0.01em">${docTitle}</h1>
      ${subtitle ? `<p style="font-size:12px;color:#6B7280;margin:6px 0 0">${subtitle}</p>` : ''}
    `
    source.insertBefore(header, source.firstChild)

    // Neutralise l'animation d'apparition (opacity 0→1) pendant la capture, sinon
    // html2canvas peut figer un rendu en plein fondu → page vide.
    const prev = { animation: source.style.animation, opacity: source.style.opacity }
    source.style.animation = 'none'
    source.style.opacity = '1'

    // Overlay blanc au-dessus de la page pendant la génération (masque les
    // manipulations ci-dessus). Élément séparé du conteneur → NON capturé.
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#ffffff;display:flex;align-items:center;justify-content:center;color:#2563EB;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600'
    overlay.textContent = 'Génération du PDF…'
    document.body.appendChild(overlay)

    try {
      // Chargement dynamique de html2pdf.js pour ne pas alourdir le bundle initial
      const html2pdf = (await import('html2pdf.js')).default

      // Attend le chargement des images avant de capturer (évite le vide).
      await waitForImages(source, 4000)

      // Options IDENTIQUES aux bulletins (méthode éprouvée). On ignore l'overlay
      // par sécurité au cas où html2canvas parcourt tout le document.
      const opt = {
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', ignoreElements: (el) => el === overlay },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }

      // On capture l'élément VIVANT (source), exactement comme le bulletin. Génère
      // un Blob puis déclenche un vrai téléchargement (fiable mobile + desktop).
      const worker = html2pdf().set(opt).from(source)
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
        await html2pdf().set(opt).from(source).save()
      }
    } catch (err) {
      if (!(err instanceof TypeError)) console.error('Erreur PDF:', err)
    } finally {
      // Restauration à l'identique du DOM vivant.
      if (header.parentNode) header.parentNode.removeChild(header)
      hidden.forEach(([el, display]) => { el.style.display = display })
      source.style.animation = prev.animation
      source.style.opacity = prev.opacity
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
      busyRef.current = false
      setBusy(false)
    }
  }

  // Bouton unique et cohérent partout, dans le style des bulletins (bleu primaire
  // + icône de téléchargement).
  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className={`btn-primary text-sm ${className}`}
    >
      <Download size={14} /> {busy ? 'Génération…' : label}
    </button>
  )
}
