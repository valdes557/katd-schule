import html2pdf from 'html2pdf.js'

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}

// Attend le chargement (ou l'échec) de toutes les images d'un conteneur avant de lancer la capture
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
    setTimeout(resolve, timeout)
  })
}

// Logo officiel vectoriel de la plateforme KATD-SCHÜLE
const PLATFORM_LOGO_SVG = `
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 4.5L2 9.5L12 14.5L20 10.5V17H22V9.5L12 4.5Z" fill="#ffffff" fill-opacity="0.95"/>
  <path d="M6 13V17C6 19.2 8.7 21 12 21C15.3 21 18 19.2 18 17V13L12 16L6 13Z" fill="#ffffff" fill-opacity="0.85"/>
</svg>
`

const PLATFORM_LOGO_WATERMARK_SVG = `
<svg width="72" height="72" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 4.5L2 9.5L12 14.5L20 10.5V17H22V9.5L12 4.5Z" fill="#ffffff"/>
  <path d="M6 13V17C6 19.2 8.7 21 12 21C15.3 21 18 19.2 18 17V13L12 16L6 13Z" fill="#ffffff"/>
</svg>
`

/**
 * Génère le drapeau national officiel en SVG vectoriel selon le pays sélectionné.
 * Supporte le Cameroun, Gabon, Congo, Côte d'Ivoire, Sénégal, Mali, Guinée, Bénin, Togo, Tchad, Burkina Faso, France, etc.
 */
export function getCountryFlagSvg(countryName) {
  const norm = String(countryName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

  // Cameroun (Vert, Rouge avec étoile jaune, Jaune)
  if (norm.includes('cameroun') || norm.includes('cameroon') || norm === 'cm') {
    return `
      <svg width="20" height="13" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style="border-radius:2px;box-shadow:0 0 1px rgba(0,0,0,0.35);vertical-align:middle;display:inline-block;flex-shrink:0;">
        <rect width="200" height="400" fill="#007a3d"/>
        <rect x="200" width="200" height="400" fill="#ce1126"/>
        <rect x="400" width="200" height="400" fill="#fcd116"/>
        <polygon points="300,160 312,198 352,198 320,222 332,260 300,236 268,260 280,222 248,198 288,198" fill="#fcd116"/>
      </svg>
    `
  }

  // Côte d'Ivoire (Orange, Blanc, Vert)
  if (norm.includes('cote d') || norm.includes('ivory coast') || norm === 'ci') {
    return `
      <svg width="20" height="13" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style="border-radius:2px;box-shadow:0 0 1px rgba(0,0,0,0.35);vertical-align:middle;display:inline-block;flex-shrink:0;">
        <rect width="200" height="400" fill="#f77f00"/>
        <rect x="200" width="200" height="400" fill="#ffffff"/>
        <rect x="400" width="200" height="400" fill="#009e60"/>
      </svg>
    `
  }

  // Sénégal (Vert, Jaune avec étoile verte, Rouge)
  if (norm.includes('senegal') || norm === 'sn') {
    return `
      <svg width="20" height="13" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style="border-radius:2px;box-shadow:0 0 1px rgba(0,0,0,0.35);vertical-align:middle;display:inline-block;flex-shrink:0;">
        <rect width="200" height="400" fill="#00853f"/>
        <rect x="200" width="200" height="400" fill="#fdef42"/>
        <rect x="400" width="200" height="400" fill="#e31b23"/>
        <polygon points="300,160 312,198 352,198 320,222 332,260 300,236 268,260 280,222 248,198 288,198" fill="#00853f"/>
      </svg>
    `
  }

  // Gabon (Vert, Jaune, Bleu)
  if (norm.includes('gabon') || norm === 'ga') {
    return `
      <svg width="20" height="13" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style="border-radius:2px;box-shadow:0 0 1px rgba(0,0,0,0.35);vertical-align:middle;display:inline-block;flex-shrink:0;">
        <rect width="600" height="133.3" fill="#009e60"/>
        <rect y="133.3" width="600" height="133.3" fill="#fcd116"/>
        <rect y="266.6" width="600" height="133.4" fill="#3675b4"/>
      </svg>
    `
  }

  // Congo (Brazzaville) (Vert, Jaune diagonal, Rouge)
  if (norm.includes('congo') && !norm.includes('rdc') && !norm.includes('kinshasa') || norm === 'cg') {
    return `
      <svg width="20" height="13" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style="border-radius:2px;box-shadow:0 0 1px rgba(0,0,0,0.35);vertical-align:middle;display:inline-block;flex-shrink:0;">
        <polygon points="0,0 400,0 0,266.6" fill="#009543"/>
        <polygon points="600,400 200,400 600,133.4" fill="#dc241f"/>
        <polygon points="400,0 600,0 600,133.4 200,400 0,400 0,266.6" fill="#fbde4a"/>
      </svg>
    `
  }

  // RDC / Congo Kinshasa (Bleu ciel, bande rouge bordée de jaune, étoile jaune)
  if (norm.includes('rdc') || norm.includes('kinshasa') || norm === 'cd') {
    return `
      <svg width="20" height="13" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style="border-radius:2px;box-shadow:0 0 1px rgba(0,0,0,0.35);vertical-align:middle;display:inline-block;flex-shrink:0;">
        <rect width="600" height="400" fill="#007fff"/>
        <polygon points="0,320 0,400 80,400 600,80 600,0 520,0" fill="#fcd116"/>
        <polygon points="0,340 0,400 60,400 600,60 600,0 540,0" fill="#ce1126"/>
        <polygon points="90,40 96,58 116,58 100,70 106,88 90,76 74,88 80,70 64,58 84,58" fill="#fcd116"/>
      </svg>
    `
  }

  // Bénin (Vert vertical à gauche, Jaune et Rouge à droite)
  if (norm.includes('benin') || norm === 'bj') {
    return `
      <svg width="20" height="13" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style="border-radius:2px;box-shadow:0 0 1px rgba(0,0,0,0.35);vertical-align:middle;display:inline-block;flex-shrink:0;">
        <rect width="240" height="400" fill="#008751"/>
        <rect x="240" width="360" height="200" fill="#fcd116"/>
        <rect x="240" y="200" width="360" height="200" fill="#e8112d"/>
      </svg>
    `
  }

  // Togo (5 bandes vert/jaune, carré rouge avec étoile blanche)
  if (norm.includes('togo') || norm === 'tg') {
    return `
      <svg width="20" height="13" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style="border-radius:2px;box-shadow:0 0 1px rgba(0,0,0,0.35);vertical-align:middle;display:inline-block;flex-shrink:0;">
        <rect width="600" height="80" fill="#006a4e"/>
        <rect y="80" width="600" height="80" fill="#ffce00"/>
        <rect y="160" width="600" height="80" fill="#006a4e"/>
        <rect y="240" width="600" height="80" fill="#ffce00"/>
        <rect y="320" width="600" height="80" fill="#006a4e"/>
        <rect width="240" height="240" fill="#d21034"/>
        <polygon points="120,70 130,105 165,105 137,126 148,160 120,139 92,160 103,126 75,105 110,105" fill="#ffffff"/>
      </svg>
    `
  }

  // Tchad (Bleu, Jaune, Rouge)
  if (norm.includes('tchad') || norm.includes('chad') || norm === 'td') {
    return `
      <svg width="20" height="13" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style="border-radius:2px;box-shadow:0 0 1px rgba(0,0,0,0.35);vertical-align:middle;display:inline-block;flex-shrink:0;">
        <rect width="200" height="400" fill="#00205b"/>
        <rect x="200" width="200" height="400" fill="#ffcd00"/>
        <rect x="400" width="200" height="400" fill="#c8102e"/>
      </svg>
    `
  }

  // Mali (Vert, Jaune, Rouge)
  if (norm.includes('mali') || norm === 'ml') {
    return `
      <svg width="20" height="13" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style="border-radius:2px;box-shadow:0 0 1px rgba(0,0,0,0.35);vertical-align:middle;display:inline-block;flex-shrink:0;">
        <rect width="200" height="400" fill="#14b53a"/>
        <rect x="200" width="200" height="400" fill="#fcd116"/>
        <rect x="400" width="200" height="400" fill="#ce1126"/>
      </svg>
    `
  }

  // Guinée (Rouge, Jaune, Vert)
  if (norm.includes('guinee') || norm.includes('guinea') || norm === 'gn') {
    return `
      <svg width="20" height="13" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style="border-radius:2px;box-shadow:0 0 1px rgba(0,0,0,0.35);vertical-align:middle;display:inline-block;flex-shrink:0;">
        <rect width="200" height="400" fill="#ce1126"/>
        <rect x="200" width="200" height="400" fill="#fcd116"/>
        <rect x="400" width="200" height="400" fill="#009460"/>
      </svg>
    `
  }

  // Burkina Faso (Rouge, Vert, étoile jaune)
  if (norm.includes('burkina') || norm === 'bf') {
    return `
      <svg width="20" height="13" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style="border-radius:2px;box-shadow:0 0 1px rgba(0,0,0,0.35);vertical-align:middle;display:inline-block;flex-shrink:0;">
        <rect width="600" height="200" fill="#ef2b2d"/>
        <rect y="200" width="600" height="200" fill="#009e49"/>
        <polygon points="300,160 312,198 352,198 320,222 332,260 300,236 268,260 280,222 248,198 288,198" fill="#fcd116"/>
      </svg>
    `
  }

  // France (Bleu, Blanc, Rouge)
  if (norm.includes('france') || norm === 'fr') {
    return `
      <svg width="20" height="13" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style="border-radius:2px;box-shadow:0 0 1px rgba(0,0,0,0.35);vertical-align:middle;display:inline-block;flex-shrink:0;">
        <rect width="200" height="400" fill="#002654"/>
        <rect x="200" width="200" height="400" fill="#ffffff"/>
        <rect x="400" width="200" height="400" fill="#ed2939"/>
      </svg>
    `
  }

  // Fallback universel Cameroun (pays siège de la plateforme)
  return `
    <svg width="20" height="13" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style="border-radius:2px;box-shadow:0 0 1px rgba(0,0,0,0.35);vertical-align:middle;display:inline-block;flex-shrink:0;">
      <rect width="200" height="400" fill="#007a3d"/>
      <rect x="200" width="200" height="400" fill="#ce1126"/>
      <rect x="400" width="200" height="400" fill="#fcd116"/>
      <polygon points="300,160 312,198 352,198 320,222 332,260 300,236 268,260 280,222 248,198 288,198" fill="#fcd116"/>
    </svg>
  `
}

function getSchoolCountry(school) {
  return school?.address?.country || school?.country || school?.countryName || 'Cameroun'
}

function renderCountryBadge(country) {
  const c = country || 'Cameroun'
  const flagSvg = getCountryFlagSvg(c)
  return `
    <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.96);color:#1e3a8a;padding:2px 7px;border-radius:5px;box-shadow:0 1px 2px rgba(0,0,0,0.15);flex-shrink:0;">
      ${flagSvg}
      <span style="font-size:8.5px;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;color:#1e3a8a;">${c}</span>
    </div>
  `
}

// Helper universel pour générer et télécharger un PDF à partir d'un conteneur DOM temporaire
async function generatePdfFromContainer(container, { filename, orientation = 'portrait', margin = [8, 8, 8, 8] } = {}) {
  // Overlay au premier plan pour masquer le rendu temporaire et afficher l'indicateur de chargement
  const overlay = document.createElement('div')
  overlay.setAttribute('data-pdf-overlay', '1')
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(255,255,255,0.96);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#2563EB;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;'
  overlay.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <svg style="animation:spin 1s linear infinite;width:24px;height:24px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
      </svg>
      <span>Génération du document PDF en cours…</span>
    </div>
    <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
  `
  document.body.appendChild(overlay)

  const targetWidth = orientation === 'landscape' ? 1100 : 800

  // Wrapper hôte invisible pour attacher le conteneur au DOM sans affecter le flux de la page
  const host = document.createElement('div')
  host.setAttribute('data-pdf-host', '1')
  host.style.cssText = `position:fixed;top:0;left:0;width:${targetWidth}px;opacity:0.001;pointer-events:none;z-index:-1;`

  // Conteneur en flux normal (position: static) : TRÈS IMPORTANT pour html2pdf / html2canvas.
  // Si le conteneur a position: fixed ou absolute, le clone créé par html2pdf s'échappe
  // du conteneur parent (html2pdf__container), donnant une hauteur 0 et une page blanche !
  container.style.position = 'static'
  container.style.display = 'block'
  container.style.width = `${targetWidth}px`
  container.style.minWidth = `${targetWidth}px`
  container.style.maxWidth = `${targetWidth}px`
  container.style.height = 'auto'
  container.style.background = '#ffffff'
  container.style.color = '#111827'
  container.style.boxSizing = 'border-box'
  container.style.margin = '0'

  host.appendChild(container)
  document.body.appendChild(host)

  const savedScrollX = window.scrollX || window.pageXOffset || 0
  const savedScrollY = window.scrollY || window.pageYOffset || 0

  try {
    window.scrollTo(0, 0)
    // Attendre le chargement des images éventuelles + tick de layout navigateur
    await waitForImages(container, 4000)
    await new Promise((resolve) => setTimeout(resolve, 250))

    const opt = {
      margin,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: targetWidth,
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation },
    }

    try {
      const blob = await html2pdf().set(opt).from(container).outputPdf('blob')
      triggerBlobDownload(blob, filename)
    } catch (_) {
      await html2pdf().set(opt).from(container).save()
    }
  } finally {
    window.scrollTo(savedScrollX, savedScrollY)
    if (host.parentNode) host.parentNode.removeChild(host)
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
  }
}

/**
 * Exporte la fiche officielle de tous les élèves de l'établissement au format PDF.
 */
export async function exportElevesFichePdf({ school, cycle, students = [] }) {
  const schoolName = school?.name || 'Établissement Scolaire'
  const schoolPhone = school?.phone || ''
  const schoolEmail = school?.email || ''
  const schoolCity = school?.address?.city || school?.city || ''
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const filename = `fiche_eleves_${schoolName.toLowerCase().replace(/[^\w]+/g, '_')}_${Date.now()}.pdf`

  const total = students.length
  const filles = students.filter((s) => s.gender === 'F').length
  const garcons = students.filter((s) => s.gender === 'M').length

  const container = document.createElement('div')
  container.id = 'export-eleves-container'
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
  container.style.padding = '24px 30px'

  container.innerHTML = `
    <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 style="font-size: 18px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin: 0;">${schoolName}</h1>
          <p style="font-size: 11px; color: #4b5563; margin: 2px 0 0 0;">
            ${schoolCity ? `${schoolCity} · ` : ''}${schoolPhone ? `Tél: ${schoolPhone} · ` : ''}${schoolEmail ? `Email: ${schoolEmail}` : ''}
          </p>
          <p style="font-size: 11px; font-weight: 600; color: #2563eb; margin: 2px 0 0 0;">
            Cycle : ${cycle || 'Général'} · KATD-SCHÜLE
          </p>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Date d'édition</span>
          <p style="font-size: 12px; font-weight: 700; color: #111827; margin: 2px 0 0 0;">${dateStr}</p>
        </div>
      </div>
    </div>

    <div style="text-align: center; margin-bottom: 18px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px;">
      <h2 style="font-size: 15px; font-weight: 800; color: #1e40af; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">
        FICHE OFFICIELLE DES ÉLÈVES INSCRITS
      </h2>
      <p style="font-size: 11px; color: #3b82f6; margin: 4px 0 0 0; font-weight: 600;">
        Effectif total : ${total} élève(s) · Filles : ${filles} · Garçons : ${garcons}
      </p>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
      <thead>
        <tr style="background: #1e3a8a; color: #ffffff; text-align: left;">
          <th style="padding: 6px 8px; border: 1px solid #1e3a8a; width: 30px; text-align: center;">N°</th>
          <th style="padding: 6px 8px; border: 1px solid #1e3a8a; width: 85px;">Matricule</th>
          <th style="padding: 6px 8px; border: 1px solid #1e3a8a;">Nom & Prénoms</th>
          <th style="padding: 6px 8px; border: 1px solid #1e3a8a; width: 45px; text-align: center;">Sexe</th>
          <th style="padding: 6px 8px; border: 1px solid #1e3a8a; width: 75px;">Classe</th>
          <th style="padding: 6px 8px; border: 1px solid #1e3a8a;">Parent / Contact</th>
        </tr>
      </thead>
      <tbody>
        ${students.map((s, idx) => `
          <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; page-break-inside: avoid;">
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: 600; color: #1e40af;">${s.matricule || '—'}</td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${(s.lastName || '').toUpperCase()} ${s.firstName || ''}</td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: ${s.gender === 'F' ? '#db2777' : '#2563eb'};">${s.gender || '—'}</td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; font-weight: 600;">${s.class?.name || '—'}</td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #334155;">
              ${s.parent?.name ? `<strong>${s.parent.name}</strong>` : '—'}
              ${s.parent?.phone ? `<br/><span style="color:#64748b; font-size: 9.5px;">📞 ${s.parent.phone}</span>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid;">
      <div style="font-size: 10px; color: #64748b;">
        <p style="margin: 0;">KATD-SCHÜLE · Système de gestion scolaire certifié</p>
        <p style="margin: 2px 0 0 0;">Document officiel à usage administratif</p>
      </div>
      <div style="text-align: center; width: 220px; border-top: 1px solid #cbd5e1; padding-top: 6px;">
        <p style="font-size: 11px; font-weight: 700; color: #0f172a; margin: 0;">Le Directeur / Principal</p>
        <p style="font-size: 9.5px; color: #94a3b8; margin: 2px 0 25px 0;">(Signature et Cachet officiel)</p>
      </div>
    </div>
  `

  await generatePdfFromContainer(container, { filename })
}

/**
 * Exporte la fiche officielle de tous les parents d'élèves au format PDF.
 */
export async function exportParentsFichePdf({ school, parents = [] }) {
  const schoolName = school?.name || 'Établissement Scolaire'
  const schoolPhone = school?.phone || ''
  const schoolEmail = school?.email || ''
  const schoolCity = school?.address?.city || school?.city || ''
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const filename = `fiche_parents_${schoolName.toLowerCase().replace(/[^\w]+/g, '_')}_${Date.now()}.pdf`

  const total = parents.length

  const container = document.createElement('div')
  container.id = 'export-parents-container'
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
  container.style.padding = '24px 30px'

  container.innerHTML = `
    <div style="border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 style="font-size: 18px; font-weight: 800; color: #065f46; text-transform: uppercase; margin: 0;">${schoolName}</h1>
          <p style="font-size: 11px; color: #4b5563; margin: 2px 0 0 0;">
            ${schoolCity ? `${schoolCity} · ` : ''}${schoolPhone ? `Tél: ${schoolPhone} · ` : ''}${schoolEmail ? `Email: ${schoolEmail}` : ''}
          </p>
          <p style="font-size: 11px; font-weight: 600; color: #059669; margin: 2px 0 0 0;">
            Répertoire des Parents d'élèves · KATD-SCHÜLE
          </p>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Date d'édition</span>
          <p style="font-size: 12px; font-weight: 700; color: #111827; margin: 2px 0 0 0;">${dateStr}</p>
        </div>
      </div>
    </div>

    <div style="text-align: center; margin-bottom: 18px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 10px;">
      <h2 style="font-size: 15px; font-weight: 800; color: #065f46; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">
        FICHE OFFICIELLE DES PARENTS D'ÉLÈVES
      </h2>
      <p style="font-size: 11px; color: #059669; margin: 4px 0 0 0; font-weight: 600;">
        Total parents répertoriés : ${total}
      </p>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
      <thead>
        <tr style="background: #065f46; color: #ffffff; text-align: left;">
          <th style="padding: 6px 8px; border: 1px solid #065f46; width: 30px; text-align: center;">N°</th>
          <th style="padding: 6px 8px; border: 1px solid #065f46; width: 140px;">Nom & Prénom du Parent</th>
          <th style="padding: 6px 8px; border: 1px solid #065f46; width: 100px;">Téléphone</th>
          <th style="padding: 6px 8px; border: 1px solid #065f46; width: 140px;">E-mail</th>
          <th style="padding: 6px 8px; border: 1px solid #065f46;">Enfants rattachés & Classes</th>
        </tr>
      </thead>
      <tbody>
        ${parents.map((p, idx) => {
          const childrenList = (p.children || [])
            .map((c) => `${c.lastName || ''} ${c.firstName || ''} (${c.class?.name || 'Classe non assignée'})`)
            .join(' ; ')
          return `
            <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; page-break-inside: avoid;">
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #0f172a;">${p.name || '—'}</td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #334155; font-weight: 600;">${p.phone || '—'}</td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #0284c7;">${p.email || '—'}</td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #334155;">${childrenList || '—'}</td>
            </tr>
          `
        }).join('')}
      </tbody>
    </table>

    <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid;">
      <div style="font-size: 10px; color: #64748b;">
        <p style="margin: 0;">KATD-SCHÜLE · Répertoire Officiel Parents</p>
        <p style="margin: 2px 0 0 0;">Document officiel à usage de la direction</p>
      </div>
      <div style="text-align: center; width: 220px; border-top: 1px solid #cbd5e1; padding-top: 6px;">
        <p style="font-size: 11px; font-weight: 700; color: #0f172a; margin: 0;">Le Directeur / Principal</p>
        <p style="font-size: 9.5px; color: #94a3b8; margin: 2px 0 25px 0;">(Signature et Cachet officiel)</p>
      </div>
    </div>
  `

  await generatePdfFromContainer(container, { filename })
}

/**
 * Exporte la fiche officielle du corps enseignant au format PDF.
 */
export async function exportEnseignantsFichePdf({ school, cycle, teachers = [] }) {
  const schoolName = school?.name || 'Établissement Scolaire'
  const schoolPhone = school?.phone || ''
  const schoolEmail = school?.email || ''
  const schoolCity = school?.address?.city || school?.city || ''
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const filename = `fiche_enseignants_${schoolName.toLowerCase().replace(/[^\w]+/g, '_')}_${Date.now()}.pdf`

  const total = teachers.length

  const container = document.createElement('div')
  container.id = 'export-enseignants-container'
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
  container.style.padding = '24px 30px'

  container.innerHTML = `
    <div style="border-bottom: 2px solid #7c3aed; padding-bottom: 12px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 style="font-size: 18px; font-weight: 800; color: #5b21b6; text-transform: uppercase; margin: 0;">${schoolName}</h1>
          <p style="font-size: 11px; color: #4b5563; margin: 2px 0 0 0;">
            ${schoolCity ? `${schoolCity} · ` : ''}${schoolPhone ? `Tél: ${schoolPhone} · ` : ''}${schoolEmail ? `Email: ${schoolEmail}` : ''}
          </p>
          <p style="font-size: 11px; font-weight: 600; color: #7c3aed; margin: 2px 0 0 0;">
            Corps Enseignant · Cycle : ${cycle || 'Général'} · KATD-SCHÜLE
          </p>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Date d'édition</span>
          <p style="font-size: 12px; font-weight: 700; color: #111827; margin: 2px 0 0 0;">${dateStr}</p>
        </div>
      </div>
    </div>

    <div style="text-align: center; margin-bottom: 18px; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 10px;">
      <h2 style="font-size: 15px; font-weight: 800; color: #5b21b6; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">
        FICHE OFFICIELLE DU CORPS ENSEIGNANT
      </h2>
      <p style="font-size: 11px; color: #7c3aed; margin: 4px 0 0 0; font-weight: 600;">
        Total enseignants en service : ${total}
      </p>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
      <thead>
        <tr style="background: #5b21b6; color: #ffffff; text-align: left;">
          <th style="padding: 6px 8px; border: 1px solid #5b21b6; width: 30px; text-align: center;">N°</th>
          <th style="padding: 6px 8px; border: 1px solid #5b21b6;">Nom & Prénoms</th>
          <th style="padding: 6px 8px; border: 1px solid #5b21b6; width: 45px; text-align: center;">Sexe</th>
          <th style="padding: 6px 8px; border: 1px solid #5b21b6;">Matière(s) / Spécialité</th>
          <th style="padding: 6px 8px; border: 1px solid #5b21b6;">Classes attribuées</th>
          <th style="padding: 6px 8px; border: 1px solid #5b21b6; width: 120px;">Contact</th>
        </tr>
      </thead>
      <tbody>
        ${teachers.map((t, idx) => {
          const subjects = Array.isArray(t.subjects) ? t.subjects.join(', ') : (t.subjects || t.speciality || '—')
          const classesStr = Array.isArray(t.classes) ? t.classes.map((c) => c.name || c).join(', ') : '—'
          return `
            <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; page-break-inside: avoid;">
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #0f172a;">
                ${(t.lastName || '').toUpperCase()} ${t.firstName || ''}
              </td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: ${t.gender === 'F' ? '#db2777' : '#2563eb'};">${t.gender || '—'}</td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; font-weight: 600; color: #4338ca;">${subjects || '—'}</td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #334155;">${classesStr || '—'}</td>
              <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #334155; font-size: 9.5px;">
                ${t.phone ? `<div>📞 ${t.phone}</div>` : ''}
                ${t.email ? `<div style="color:#0284c7;">✉️ ${t.email}</div>` : ''}
              </td>
            </tr>
          `
        }).join('')}
      </tbody>
    </table>

    <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid;">
      <div style="font-size: 10px; color: #64748b;">
        <p style="margin: 0;">KATD-SCHÜLE · Gestion du Personnel Enseignant</p>
        <p style="margin: 2px 0 0 0;">Document officiel certifié</p>
      </div>
      <div style="text-align: center; width: 220px; border-top: 1px solid #cbd5e1; padding-top: 6px;">
        <p style="font-size: 11px; font-weight: 700; color: #0f172a; margin: 0;">Le Directeur / Principal</p>
        <p style="font-size: 9.5px; color: #94a3b8; margin: 2px 0 25px 0;">(Signature et Cachet officiel)</p>
      </div>
    </div>
  `

  await generatePdfFromContainer(container, { filename })
}

/**
 * Exporte la liste administrative du personnel non-enseignant (sans afficher les salaires).
 */
export async function exportPersonnelFichePdf({ school, staff = [] }) {
  const schoolName = school?.name || 'Établissement Scolaire'
  const schoolPhone = school?.phone || ''
  const schoolEmail = school?.email || ''
  const schoolCity = school?.address?.city || school?.city || ''
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const filename = `fiche_personnel_${schoolName.toLowerCase().replace(/[^\w]+/g, '_')}_${Date.now()}.pdf`

  const total = staff.length

  const container = document.createElement('div')
  container.id = 'export-personnel-container'
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
  container.style.padding = '24px 30px'

  container.innerHTML = `
    <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 style="font-size: 18px; font-weight: 800; color: #0369a1; text-transform: uppercase; margin: 0;">${schoolName}</h1>
          <p style="font-size: 11px; color: #4b5563; margin: 2px 0 0 0;">
            ${schoolCity ? `${schoolCity} · ` : ''}${schoolPhone ? `Tél: ${schoolPhone} · ` : ''}${schoolEmail ? `Email: ${schoolEmail}` : ''}
          </p>
          <p style="font-size: 11px; font-weight: 600; color: #0284c7; margin: 2px 0 0 0;">
            Registre Administratif du Personnel Non-Enseignant · KATD-SCHÜLE
          </p>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Date d'édition</span>
          <p style="font-size: 12px; font-weight: 700; color: #111827; margin: 2px 0 0 0;">${dateStr}</p>
        </div>
      </div>
    </div>

    <div style="text-align: center; margin-bottom: 18px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 10px;">
      <h2 style="font-size: 15px; font-weight: 800; color: #0369a1; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">
        LISTE OFFICIELLE DU PERSONNEL (USAGE ADMINISTRATIF)
      </h2>
      <p style="font-size: 11px; color: #0284c7; margin: 4px 0 0 0; font-weight: 600;">
        Total personnel en service : ${total} membre(s)
      </p>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
      <thead>
        <tr style="background: #0369a1; color: #ffffff; text-align: left;">
          <th style="padding: 6px 8px; border: 1px solid #0369a1; width: 30px; text-align: center;">N°</th>
          <th style="padding: 6px 8px; border: 1px solid #0369a1;">Nom & Prénoms</th>
          <th style="padding: 6px 8px; border: 1px solid #0369a1; width: 150px;">Fonction / Rôle</th>
          <th style="padding: 6px 8px; border: 1px solid #0369a1; width: 110px;">Téléphone</th>
          <th style="padding: 6px 8px; border: 1px solid #0369a1; width: 140px;">E-mail</th>
          <th style="padding: 6px 8px; border: 1px solid #0369a1; width: 70px; text-align: center;">Statut</th>
        </tr>
      </thead>
      <tbody>
        ${staff.map((m, idx) => `
          <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; page-break-inside: avoid;">
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #0f172a;">${(m.lastName || '').toUpperCase()} ${m.firstName || ''}</td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #334155; font-weight: 600;">${m.jobTitle || m.category || 'Personnel'}</td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #475569;">${m.phone || '—'}</td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #0284c7;">${m.email || '—'}</td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: ${m.status === 'active' ? '#16a34a' : '#6b7280'};">
              ${m.status === 'active' ? 'Actif' : m.status === 'on_leave' ? 'En congé' : 'Inactif'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid;">
      <div style="font-size: 10px; color: #64748b;">
        <p style="margin: 0;">KATD-SCHÜLE · Répertoire Administratif Officiel</p>
        <p style="margin: 2px 0 0 0;">Document administratif sans données salariales</p>
      </div>
      <div style="text-align: center; width: 220px; border-top: 1px solid #cbd5e1; padding-top: 6px;">
        <p style="font-size: 11px; font-weight: 700; color: #0f172a; margin: 0;">Le Directeur / Principal</p>
        <p style="font-size: 9.5px; color: #94a3b8; margin: 2px 0 25px 0;">(Signature et Cachet officiel)</p>
      </div>
    </div>
  `

  await generatePdfFromContainer(container, { filename })
}

/**
 * Exporte des badges professionnels imprimables (enseignants ou personnel).
 */
export async function exportBadgesPdf({ school, members = [], roleTitle = 'Personnel' }) {
  const schoolName = school?.name || 'Établissement Scolaire'
  const schoolPhone = school?.phone || ''
  const schoolEmail = school?.email || ''
  const schoolCity = school?.address?.city || school?.city || ''
  const schoolCountry = getSchoolCountry(school)
  const filename = `badges_${roleTitle.toLowerCase().replace(/[^\w]+/g, '_')}_${Date.now()}.pdf`

  const container = document.createElement('div')
  container.id = 'export-badges-container'
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
  container.style.padding = '20px'

  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 16px; border-bottom: 2px solid #4f46e5; padding-bottom: 8px;">
      <h2 style="font-size: 16px; font-weight: 800; color: #3730a3; margin: 0; text-transform: uppercase;">
        ${schoolName} · BADGES PROFESSIONNELS (${roleTitle.toUpperCase()})
      </h2>
      <p style="font-size: 10px; color: #6b7280; margin: 2px 0 0 0;">Découpez suivant les pointillés · Format standard professionnel</p>
    </div>

    <div style="display: flex; flex-wrap: wrap; gap: 16px; justify-content: center;">
      ${members.map((m) => {
        const fullName = `${(m.lastName || '').toUpperCase()} ${m.firstName || ''}`
        const role = m.contractType ? (m.contractType === 'permanent' ? 'Enseignant Permanent' : 'Enseignant Vacataire') : (m.jobTitle || m.category || roleTitle)
        const photoUrl = m.photo || m.avatar || m.user?.photo || m.user?.avatar || ''
        const subInfo = m.subjects ? (Array.isArray(m.subjects) ? m.subjects.join(', ') : m.subjects) : (m.phone || '')
        const mat = m.user?.matricule || m.matricule || `ID-${String(m._id || '').slice(-6).toUpperCase()}`

        return `
          <div style="width: 350px; height: 215px; border: 2px dashed #94a3b8; border-radius: 12px; padding: 12px; box-sizing: border-box; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; page-break-inside: avoid; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
            <div style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); color: #ffffff; padding: 6px 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden;">
              <!-- Logo filigrane à l'angle en arrière-plan -->
              <div style="position: absolute; right: 90px; top: -14px; opacity: 0.12; pointer-events: none;">
                ${PLATFORM_LOGO_WATERMARK_SVG}
              </div>

              <!-- Logo de la plateforme à l'angle devant/avec le nom de l'école -->
              <div style="display: flex; align-items: center; gap: 7px; z-index: 1;">
                <div style="width: 24px; height: 24px; border-radius: 5px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.35); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  ${PLATFORM_LOGO_SVG}
                </div>
                <div>
                  <p style="font-size: 11px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">${schoolName}</p>
                  <p style="font-size: 8.5px; margin: 1px 0 0 0; opacity: 0.9;">${schoolCity || 'Établissement Scolaire'}</p>
                </div>
              </div>

              <!-- Drapeau du pays de l'école à la place de KATD-SCHÜLE -->
              <div style="z-index: 1;">
                ${renderCountryBadge(schoolCountry)}
              </div>
            </div>

            <div style="display: flex; gap: 12px; align-items: center; margin: 8px 0;">
              <div style="width: 70px; height: 80px; border-radius: 8px; background: #f1f5f9; border: 1.5px solid #cbd5e1; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${photoUrl ? `<img src="${photoUrl}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="font-size: 24px; font-weight: bold; color: #94a3b8;">${(m.lastName || '?')[0]}</span>`}
              </div>
              <div style="flex: 1; min-width: 0;">
                <p style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">${fullName}</p>
                <p style="font-size: 10px; font-weight: 700; color: #2563eb; margin: 2px 0 0 0;">${role}</p>
                ${subInfo ? `<p style="font-size: 9px; color: #475569; margin: 2px 0 0 0;">${subInfo}</p>` : ''}
                <p style="font-size: 8.5px; font-family: monospace; color: #64748b; margin: 3px 0 0 0;">N° Matricule : <strong>${mat}</strong></p>
                ${m.phone ? `<p style="font-size: 8.5px; color: #64748b; margin: 1px 0 0 0;">Tél : ${m.phone}</p>` : ''}
              </div>
            </div>

            <div style="border-top: 1px solid #e2e8f0; padding-top: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #64748b;">
              <span>Badge certifié · ${schoolPhone ? `Contact: ${schoolPhone}` : schoolEmail}</span>
              <span style="font-weight: bold; color: #1e3a8a;">LE DIRECTEUR</span>
            </div>
          </div>
        `
      }).join('')}
    </div>
  `

  await generatePdfFromContainer(container, { filename })
}

/**
 * Exporte la carte scolaire officielle d'un ou plusieurs élèves avec coordonnées complètes de l'établissement (Point 9).
 */
export async function exportCarteScolairePdf({ school, students = [] }) {
  const schoolName = school?.name || 'Établissement Scolaire'
  const schoolPhone = school?.phone || school?.contact?.phone || ''
  const schoolEmail = school?.email || school?.contact?.email || ''
  const schoolCity = school?.address?.city || school?.city || ''
  const schoolNeighborhood = school?.address?.neighborhood || ''
  const schoolCountry = getSchoolCountry(school)
  const schoolAddressFull = [school?.address?.address, schoolNeighborhood, schoolCity, schoolCountry].filter(Boolean).join(', ')
  const facebook = school?.socials?.facebook || ''
  const whatsapp = school?.socials?.whatsapp || schoolPhone
  const filename = `cartes_scolaires_${schoolName.toLowerCase().replace(/[^\w]+/g, '_')}_${Date.now()}.pdf`

  const container = document.createElement('div')
  container.id = 'export-carte-scolaire-container'
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
  container.style.padding = '20px'

  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 16px; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">
      <h2 style="font-size: 16px; font-weight: 800; color: #1e3a8a; margin: 0; text-transform: uppercase;">
        ${schoolName} · CARTES SCOLAIRES OFFICIELLES
      </h2>
      <p style="font-size: 10px; color: #6b7280; margin: 2px 0 0 0;">Format officiel élèves · Informations complètes et coordonnées de l'établissement</p>
    </div>

    <div style="display: flex; flex-wrap: wrap; gap: 16px; justify-content: center;">
      ${students.map((s) => {
        const dob = s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('fr-FR') : '—'
        const pob = s.placeOfBirth ? ` à ${s.placeOfBirth}` : ''

        const photoUrl = s.photo || s.avatar || s.user?.photo || s.user?.avatar || ''

        return `
          <div style="width: 350px; height: 220px; border: 2px solid #2563eb; border-radius: 12px; padding: 10px; box-sizing: border-box; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; page-break-inside: avoid; box-shadow: 0 2px 4px rgba(0,0,0,0.06);">
            <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: #ffffff; padding: 6px 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden;">
              <!-- Logo filigrane à l'angle en arrière-plan -->
              <div style="position: absolute; right: 90px; top: -14px; opacity: 0.12; pointer-events: none;">
                ${PLATFORM_LOGO_WATERMARK_SVG}
              </div>

              <!-- Logo de la plateforme à l'angle devant/avec le nom de l'école -->
              <div style="display: flex; align-items: center; gap: 7px; z-index: 1;">
                <div style="width: 24px; height: 24px; border-radius: 5px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.35); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  ${PLATFORM_LOGO_SVG}
                </div>
                <div>
                  <p style="font-size: 11px; font-weight: 800; margin: 0; text-transform: uppercase;">${schoolName}</p>
                  <p style="font-size: 8px; margin: 1px 0 0 0; opacity: 0.95;">CARTE SCOLAIRE D'ÉLÈVE · ${s.academicYear || 'Année en cours'}</p>
                </div>
              </div>

              <!-- Drapeau du pays de chaque école à la place de KATD SCHÜLE -->
              <div style="display: flex; align-items: center; gap: 4px; z-index: 1;">
                ${renderCountryBadge(schoolCountry)}
                <span style="font-size: 8px; font-weight: 700; background: #ffffff; color: #1e40af; padding: 2px 5px; border-radius: 3px;">${s.cycle || 'Général'}</span>
              </div>
            </div>

            <div style="display: flex; gap: 10px; align-items: center; margin: 6px 0;">
              <div style="width: 65px; height: 75px; border-radius: 6px; background: #eff6ff; border: 1.5px solid #bfdbfe; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${photoUrl ? `<img src="${photoUrl}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="font-size: 22px; font-weight: bold; color: #3b82f6;">${(s.lastName || '?')[0]}</span>`}
              </div>
              <div style="flex: 1; min-width: 0; font-size: 9px; line-height: 1.35;">
                <p style="font-size: 11.5px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">${s.lastName} ${s.firstName}</p>
                <p style="margin: 2px 0 0 0; color: #1e40af; font-weight: 700;">Classe : <strong>${s.class?.name || '—'}</strong> · Matricule : <span style="font-family: monospace;">${s.matricule || '—'}</span></p>
                <p style="margin: 2px 0 0 0; color: #475569;">Né(e) le : ${dob}${pob}</p>
                <p style="margin: 1px 0 0 0; color: #475569;">Statut : <strong>${s.studentType === 'ancien' ? 'Ancien(ne)' : 'Nouveau(lle)'}</strong> · Sexe : ${s.gender === 'F' ? 'Féminin' : 'Masculin'}</p>
                ${s.parent?.phone ? `<p style="margin: 1px 0 0 0; color: #475569;">Contact urgence : ${s.parent.phone}</p>` : ''}
              </div>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 4px 6px; font-size: 7.5px; color: #334155; line-height: 1.25;">
              <p style="margin: 0; font-weight: 600;">📍 <strong>Adresse :</strong> ${schoolAddressFull || schoolCity || 'Adresse sur demande'}</p>
              <div style="display: flex; justify-content: space-between; flex-wrap: wrap; margin-top: 1px;">
                ${schoolPhone ? `<span>📞 <strong>Tél :</strong> ${schoolPhone}</span>` : ''}
                ${schoolEmail ? `<span>✉️ <strong>Email :</strong> ${schoolEmail}</span>` : ''}
                ${whatsapp ? `<span>💬 <strong>WhatsApp :</strong> ${whatsapp}</span>` : ''}
                ${facebook ? `<span>🌐 <strong>FB :</strong> ${facebook}</span>` : ''}
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-end; font-size: 7.5px; color: #64748b; margin-top: 2px;">
              <span>Document officiel certifié</span>
              <span style="font-weight: 700; color: #0f172a;">Le Directeur (Cachet & Signature)</span>
            </div>
          </div>
        `
      }).join('')}
    </div>
  `

  await generatePdfFromContainer(container, { filename })
}

/**
 * Exporte la liste des retards de paiement (Point 4).
 */
export async function exportRetardsPaiementPdf({ school, month, lateStudents = [], summary = {} }) {
  const schoolName = school?.name || 'Établissement Scolaire'
  const schoolPhone = school?.phone || ''
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const filename = `retards_paiement_${month || 'global'}_${Date.now()}.pdf`
  const fmt = (n) => `${(Number(n) || 0).toLocaleString('fr-FR')} F CFA`

  const container = document.createElement('div')
  container.id = 'export-retards-container'
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
  container.style.padding = '24px 30px'

  const totalCount = summary.totalLateStudents ?? summary.studentCount ?? lateStudents.length
  const totalAmount = summary.totalLateAmount ?? summary.totalRemaining ?? lateStudents.reduce((acc, s) => acc + (s.totalRemaining ?? s.remaining ?? 0), 0)

  container.innerHTML = `
    <div style="border-bottom: 2px solid #dc2626; padding-bottom: 12px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 style="font-size: 18px; font-weight: 800; color: #991b1b; text-transform: uppercase; margin: 0;">${schoolName}</h1>
          <p style="font-size: 11px; color: #4b5563; margin: 2px 0 0 0;">${schoolPhone ? `Tél: ${schoolPhone} · ` : ''}KATD-SCHÜLE Gestion Financière</p>
          <p style="font-size: 11px; font-weight: 600; color: #dc2626; margin: 2px 0 0 0;">
            État des créances et retards de paiement · Mois : ${month || 'Sélection'}
          </p>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Date d'édition</span>
          <p style="font-size: 12px; font-weight: 700; color: #111827; margin: 2px 0 0 0;">${dateStr}</p>
        </div>
      </div>
    </div>

    <div style="text-align: center; margin-bottom: 18px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px;">
      <h2 style="font-size: 15px; font-weight: 800; color: #991b1b; text-transform: uppercase; margin: 0;">
        LISTE DES ÉLÈVES EN RETARD DE PAIEMENT
      </h2>
      <p style="font-size: 12px; color: #dc2626; margin: 4px 0 0 0; font-weight: 700;">
        Total élèves en retard : ${totalCount} · Montant total restant dû : ${fmt(totalAmount)}
      </p>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
      <thead>
        <tr style="background: #991b1b; color: #ffffff; text-align: left;">
          <th style="padding: 6px 8px; border: 1px solid #991b1b; width: 25px; text-align: center;">N°</th>
          <th style="padding: 6px 8px; border: 1px solid #991b1b; width: 80px;">Matricule</th>
          <th style="padding: 6px 8px; border: 1px solid #991b1b;">Élève & Classe</th>
          <th style="padding: 6px 8px; border: 1px solid #991b1b; width: 140px;">Parent & Contact</th>
          <th style="padding: 6px 8px; border: 1px solid #991b1b; width: 80px; text-align: right;">Total Dû</th>
          <th style="padding: 6px 8px; border: 1px solid #991b1b; width: 80px; text-align: right;">Payé</th>
          <th style="padding: 6px 8px; border: 1px solid #991b1b; width: 90px; text-align: right;">Reste Dû</th>
        </tr>
      </thead>
      <tbody>
        ${lateStudents.map((s, idx) => `
          <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; page-break-inside: avoid;">
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: 600; color: #991b1b;">${s.matricule || '—'}</td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #0f172a;">
              ${s.studentName}<br/><span style="font-weight: 600; color: #2563eb; font-size: 9.5px;">Classe : ${s.className}</span>
            </td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; color: #334155;">
              <strong>${s.parentName || '—'}</strong>
              ${s.parentPhone ? `<br/><span style="color:#059669; font-weight: 600;">📞 ${s.parentPhone}</span>` : ''}
            </td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: right;">${fmt(s.totalDue ?? s.amount ?? 0)}</td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: right; color: #16a34a; font-weight: 600;">${fmt(s.totalPaid ?? s.paid ?? 0)}</td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: right; color: #dc2626; font-weight: 800;">${fmt(s.totalRemaining ?? s.remaining ?? 0)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid;">
      <div style="font-size: 10px; color: #64748b;">
        <p style="margin: 0;">KATD-SCHÜLE · Suivi des Recouvrements Scolaires</p>
        <p style="margin: 2px 0 0 0;">Document financier confidentiel</p>
      </div>
      <div style="text-align: center; width: 220px; border-top: 1px solid #cbd5e1; padding-top: 6px;">
        <p style="font-size: 11px; font-weight: 700; color: #0f172a; margin: 0;">La Direction Financière</p>
        <p style="font-size: 9.5px; color: #94a3b8; margin: 2px 0 25px 0;">(Signature et Cachet officiel)</p>
      </div>
    </div>
  `

  await generatePdfFromContainer(container, { filename })
}

/**
 * Exporte le Compte de Résultat Mensuel ou Annuel (Point 2).
 */
export async function exportCompteDeResultatPdf({ school, year, monthData, annualSummary }) {
  const schoolName = school?.name || 'Établissement Scolaire'
  const schoolPhone = school?.phone || ''
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const isMonth = !!monthData
  const title = isMonth ? `Compte de Résultat — ${monthData.monthName} ${year}` : `Compte de Résultat Annuel — Exercice ${year}`
  const filename = `compte_resultat_${isMonth ? monthData.periodKey : year}_${Date.now()}.pdf`
  const fmt = (n) => `${(Number(n) || 0).toLocaleString('fr-FR')} F CFA`

  const totalRev = isMonth ? monthData.totalRevenue : annualSummary.totalRevenue
  const totalExp = isMonth ? monthData.totalExpenses : annualSummary.totalExpenses
  const net = isMonth ? monthData.netResult : annualSummary.netResult
  const isBenefice = net >= 0

  const container = document.createElement('div')
  container.id = 'export-compte-resultat-container'
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
  container.style.padding = '24px 30px'

  const expCats = isMonth ? monthData.expensesByCategory : annualSummary.expensesByCategory

  container.innerHTML = `
    <div style="border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 style="font-size: 18px; font-weight: 800; color: #065f46; text-transform: uppercase; margin: 0;">${schoolName}</h1>
          <p style="font-size: 11px; color: #4b5563; margin: 2px 0 0 0;">${schoolPhone ? `Tél: ${schoolPhone} · ` : ''}KATD-SCHÜLE Comptabilité</p>
          <p style="font-size: 11px; font-weight: 600; color: #059669; margin: 2px 0 0 0;">${title}</p>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Date d'édition</span>
          <p style="font-size: 12px; font-weight: 700; color: #111827; margin: 2px 0 0 0;">${dateStr}</p>
        </div>
      </div>
    </div>

    <!-- Synthèse Résultat Net -->
    <div style="margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; text-align: center;">
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px;">
        <span style="font-size: 10px; color: #1e40af; font-weight: 700; text-transform: uppercase;">Total Recettes</span>
        <p style="font-size: 14px; font-weight: 800; color: #1d4ed8; margin: 4px 0 0 0;">${fmt(totalRev)}</p>
      </div>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px;">
        <span style="font-size: 10px; color: #991b1b; font-weight: 700; text-transform: uppercase;">Total Dépenses</span>
        <p style="font-size: 14px; font-weight: 800; color: #b91c1c; margin: 4px 0 0 0;">${fmt(totalExp)}</p>
      </div>
      <div style="background: ${isBenefice ? '#ecfdf5' : '#fff1f2'}; border: 1px solid ${isBenefice ? '#a7f3d0' : '#fecdd3'}; border-radius: 8px; padding: 10px;">
        <span style="font-size: 10px; color: ${isBenefice ? '#065f46' : '#9f1239'}; font-weight: 700; text-transform: uppercase;">
          ${isBenefice ? 'Résultat Net (Bénéfice)' : 'Résultat Net (Déficit)'}
        </span>
        <p style="font-size: 14px; font-weight: 800; color: ${isBenefice ? '#059669' : '#e11d48'}; margin: 4px 0 0 0;">${fmt(net)}</p>
      </div>
    </div>

    <!-- Tableau Recettes vs Dépenses -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
      <!-- Recettes -->
      <div>
        <h3 style="font-size: 12px; font-weight: 800; color: #1d4ed8; text-transform: uppercase; margin: 0 0 8px 0; border-bottom: 1.5px solid #bfdbfe; padding-bottom: 4px;">
          1. RECETTES ENCAISSÉES
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <tbody>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 6px 0; font-weight: 600;">Frais de scolarité & pensions</td>
              <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #1d4ed8;">${fmt(isMonth ? monthData.tuitionRevenue : annualSummary.totalTuitionRevenue)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 6px 0; font-weight: 600;">Autres recettes (inscriptions, cantine, transport...)</td>
              <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0284c7;">${fmt(isMonth ? monthData.otherRevenue : annualSummary.totalOtherRevenue)}</td>
            </tr>
            <tr style="background: #f8fafc; font-weight: 800;">
              <td style="padding: 6px 4px;">TOTAL DES RECETTES</td>
              <td style="padding: 6px 4px; text-align: right; color: #1e40af;">${fmt(totalRev)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Dépenses -->
      <div>
        <h3 style="font-size: 12px; font-weight: 800; color: #b91c1c; text-transform: uppercase; margin: 0 0 8px 0; border-bottom: 1.5px solid #fecaca; padding-bottom: 4px;">
          2. DÉPENSES PAR CATÉGORIE
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <tbody>
            ${Object.entries(expCats || {}).map(([cat, val]) => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; text-transform: capitalize;">${cat}</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #374151;">${fmt(val)}</td>
              </tr>
            `).join('')}
            <tr style="background: #fef2f2; font-weight: 800;">
              <td style="padding: 6px 4px;">TOTAL DES DÉPENSES</td>
              <td style="padding: 6px 4px; text-align: right; color: #991b1b;">${fmt(totalExp)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid;">
      <div style="font-size: 10px; color: #64748b;">
        <p style="margin: 0;">KATD-SCHÜLE · Système Comptable Certifié</p>
        <p style="margin: 2px 0 0 0;">Rapport financier conforme pour l'établissement</p>
      </div>
      <div style="text-align: center; width: 220px; border-top: 1px solid #cbd5e1; padding-top: 6px;">
        <p style="font-size: 11px; font-weight: 700; color: #0f172a; margin: 0;">Le Directeur / Comptable</p>
        <p style="font-size: 9.5px; color: #94a3b8; margin: 2px 0 25px 0;">(Signature et Cachet officiel)</p>
      </div>
    </div>
  `

  await generatePdfFromContainer(container, { filename })
}

/**
 * Exporte un cours rédigé ou dispensé par l'IA au format PDF officiel avec mise en page complète et gestion propre des images.
 */
export async function exportAiCoursePdf({ course, questions = [], school }) {
  const title = course?.title || 'Cours pédagogique'
  const subject = course?.subject || 'Matière'
  const className = course?.className || course?.class?.name || 'Classe'
  const teacherName = course?.teacherName || "L'IA Enseignante"
  const duration = course?.durationMinutes || 45
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const schoolName = school?.name || course?.school?.name || 'Établissement Scolaire'
  const schoolCountry = getSchoolCountry(school || course?.school)
  const safeTitle = title.toLowerCase().replace(/[^\w]+/g, '_').slice(0, 50)
  const safeSubject = subject.toLowerCase().replace(/[^\w]+/g, '_').slice(0, 30)
  const filename = `cours_${safeSubject}_${safeTitle}_${Date.now()}.pdf`

  const container = document.createElement('div')
  container.id = 'export-ai-course-container'
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
  container.style.padding = '28px 34px'
  container.style.color = '#111827'
  container.style.background = '#ffffff'

  // Parsing du texte du cours en paragraphes et images Markdown
  const text = course?.text || course?.lessonScript || course?.sourceText || ''
  const paragraphs = text ? text.split('\n\n') : ['Contenu du cours en attente de génération.']

  const renderedContent = paragraphs.map((p) => {
    const trimmed = p.trim()
    if (!trimmed) return ''
    const imgMatch = trimmed.match(/!\[(.*?)\]\((.*?)\)/)
    if (imgMatch) {
      return `
        <div style="margin: 20px 0; text-align: center; page-break-inside: avoid;">
          <img src="${imgMatch[2]}" alt="${imgMatch[1] || ''}" crossorigin="anonymous" style="max-width: 85%; max-height: 350px; border-radius: 8px; border: 1px solid #e5e7eb; display: block; margin: 0 auto;" />
          ${imgMatch[1] ? `<p style="font-size: 11px; color: #6b7280; font-style: italic; margin-top: 6px;">Figure : ${imgMatch[1]}</p>` : ''}
        </div>
      `
    }
    if (trimmed.startsWith('# ')) {
      return `<h2 style="font-size: 17px; font-weight: 800; color: #4338ca; margin: 18px 0 8px 0; border-bottom: 1px solid #e0e7ff; padding-bottom: 4px;">${trimmed.replace(/^# /, '')}</h2>`
    }
    if (trimmed.startsWith('## ')) {
      return `<h3 style="font-size: 14px; font-weight: 700; color: #1e3a8a; margin: 14px 0 6px 0;">${trimmed.replace(/^## /, '')}</h3>`
    }
    if (trimmed.startsWith('### ')) {
      return `<h4 style="font-size: 12.5px; font-weight: 700; color: #374151; margin: 10px 0 4px 0;">${trimmed.replace(/^### /, '')}</h4>`
    }
    return `<p style="font-size: 13px; line-height: 1.65; color: #1f2937; margin: 0 0 12px 0;">${trimmed}</p>`
  }).join('')

  const renderedQuestions = (questions && questions.length > 0) ? `
    <div style="margin-top: 30px; border-top: 2px solid #e0e7ff; padding-top: 18px; page-break-inside: avoid;">
      <h3 style="font-size: 14px; font-weight: 800; color: #4338ca; margin: 0 0 12px 0; text-transform: uppercase;">
        Questions des élèves & Réponses pédagogiques (${questions.length})
      </h3>
      ${questions.map((q) => `
        <div style="margin-bottom: 12px; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <p style="font-size: 12px; font-weight: 700; color: #0f172a; margin: 0;">
            Q : ${q.text || q.question} ${q.studentName ? `<span style="font-size: 10.5px; font-weight: normal; color: #64748b;">(${q.studentName})</span>` : ''}
          </p>
          <p style="font-size: 12px; color: #334155; margin: 5px 0 0 0; line-height: 1.5;">
            <strong style="color: #4338ca;">R :</strong> ${q.answer || 'Réponse pédagogique dispensée.'}
          </p>
        </div>
      `).join('')}
    </div>
  ` : ''

  container.innerHTML = `
    <div style="border-bottom: 2.5px solid #6366f1; padding-bottom: 14px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 28px; height: 28px; border-radius: 6px; background: #6366f1; display: flex; align-items: center; justify-content: center;">
            ${PLATFORM_LOGO_SVG}
          </div>
          <div>
            <h2 style="font-size: 14px; font-weight: 800; color: #4338ca; text-transform: uppercase; margin: 0;">${schoolName}</h2>
            <p style="font-size: 10px; color: #6b7280; margin: 2px 0 0 0;">Support Pédagogique Officiel · Cours dispensé par l'IA</p>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${renderCountryBadge(schoolCountry)}
          <span style="font-size: 11px; font-weight: 600; color: #64748b;">${dateStr}</span>
        </div>
      </div>

      <div style="margin-top: 16px; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 12px 16px;">
        <h1 style="font-size: 20px; font-weight: 800; color: #4338ca; margin: 0 0 8px 0; line-height: 1.25;">
          ${title}
        </h1>
        <div style="display: flex; flex-wrap: wrap; gap: 14px; font-size: 11px; color: #4b5563;">
          <span><strong>Matière :</strong> <span style="color:#6366f1; font-weight:700;">${subject}</span></span>
          <span><strong>Classe :</strong> <strong>${className}</strong></span>
          <span><strong>Enseignant :</strong> ${teacherName}</span>
          <span><strong>Durée :</strong> ${duration} min</span>
        </div>
      </div>
    </div>

    <div style="min-height: 200px;">
      ${renderedContent}
    </div>

    ${renderedQuestions}

    <div style="margin-top: 36px; border-top: 1px solid #cbd5e1; padding-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; color: #94a3b8; page-break-inside: avoid;">
      <div>
        <p style="margin: 0; font-weight: 600; color: #64748b;">KATD-SCHÜLE · Module d'Enseignement par Intelligence Artificielle</p>
        <p style="margin: 2px 0 0 0;">Document pédagogique conforme au programme académique</p>
      </div>
      <div style="text-align: right;">
        <p style="margin: 0; font-weight: 700; color: #4338ca;">Archives & Certification Établissement</p>
      </div>
    </div>
  `

  await generatePdfFromContainer(container, { filename })
}
