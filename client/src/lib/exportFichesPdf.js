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
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 800px;
    background: #ffffff;
    color: #111827;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    padding: 24px 30px;
    box-sizing: border-box;
  `

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

  document.body.appendChild(container)

  const opt = {
    margin: [8, 8, 8, 8],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }

  try {
    const blob = await html2pdf().set(opt).from(container).outputPdf('blob')
    triggerBlobDownload(blob, filename)
  } catch (_) {
    await html2pdf().set(opt).from(container).save()
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container)
  }
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
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 800px;
    background: #ffffff;
    color: #111827;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    padding: 24px 30px;
    box-sizing: border-box;
  `

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

  document.body.appendChild(container)

  const opt = {
    margin: [8, 8, 8, 8],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }

  try {
    const blob = await html2pdf().set(opt).from(container).outputPdf('blob')
    triggerBlobDownload(blob, filename)
  } catch (_) {
    await html2pdf().set(opt).from(container).save()
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container)
  }
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
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 800px;
    background: #ffffff;
    color: #111827;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    padding: 24px 30px;
    box-sizing: border-box;
  `

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

  document.body.appendChild(container)

  const opt = {
    margin: [8, 8, 8, 8],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }

  try {
    const blob = await html2pdf().set(opt).from(container).outputPdf('blob')
    triggerBlobDownload(blob, filename)
  } catch (_) {
    await html2pdf().set(opt).from(container).save()
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container)
  }
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
  container.style.cssText = `
    position: fixed; left: -9999px; top: 0; width: 800px; background: #ffffff;
    color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    padding: 24px 30px; box-sizing: border-box;
  `

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

  document.body.appendChild(container)
  const opt = {
    margin: [8, 8, 8, 8], filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }

  try {
    const blob = await html2pdf().set(opt).from(container).outputPdf('blob')
    triggerBlobDownload(blob, filename)
  } catch (_) {
    await html2pdf().set(opt).from(container).save()
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container)
  }
}

/**
 * Exporte des badges professionnels imprimables (enseignants ou personnel).
 */
export async function exportBadgesPdf({ school, members = [], roleTitle = 'Personnel' }) {
  const schoolName = school?.name || 'Établissement Scolaire'
  const schoolPhone = school?.phone || ''
  const schoolEmail = school?.email || ''
  const schoolCity = school?.address?.city || school?.city || ''
  const filename = `badges_${roleTitle.toLowerCase().replace(/[^\w]+/g, '_')}_${Date.now()}.pdf`

  const container = document.createElement('div')
  container.id = 'export-badges-container'
  container.style.cssText = `
    position: fixed; left: -9999px; top: 0; width: 800px; background: #ffffff;
    color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    padding: 20px; box-sizing: border-box;
  `

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
        const subInfo = m.subjects ? (Array.isArray(m.subjects) ? m.subjects.join(', ') : m.subjects) : (m.phone || '')
        const mat = m.user?.matricule || m.matricule || `ID-${String(m._id || '').slice(-6).toUpperCase()}`

        return `
          <div style="width: 350px; height: 215px; border: 2px dashed #94a3b8; border-radius: 12px; padding: 12px; box-sizing: border-box; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; page-break-inside: avoid; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
            <div style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); color: #ffffff; padding: 6px 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <p style="font-size: 11px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">${schoolName}</p>
                <p style="font-size: 8.5px; margin: 1px 0 0 0; opacity: 0.9;">${schoolCity || 'Établissement Scolaire'}</p>
              </div>
              <span style="font-size: 8px; font-weight: 700; background: #ffffff; color: #1e3a8a; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">KATD-SCHÜLE</span>
            </div>

            <div style="display: flex; gap: 12px; align-items: center; margin: 8px 0;">
              <div style="width: 70px; height: 80px; border-radius: 8px; background: #f1f5f9; border: 1.5px solid #cbd5e1; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${m.photo ? `<img src="${m.photo}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="font-size: 24px; font-weight: bold; color: #94a3b8;">${(m.lastName || '?')[0]}</span>`}
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

  document.body.appendChild(container)
  const opt = {
    margin: [8, 8, 8, 8], filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }

  try {
    const blob = await html2pdf().set(opt).from(container).outputPdf('blob')
    triggerBlobDownload(blob, filename)
  } catch (_) {
    await html2pdf().set(opt).from(container).save()
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container)
  }
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
  const schoolCountry = school?.address?.country || 'Cameroun'
  const schoolAddressFull = [school?.address?.address, schoolNeighborhood, schoolCity, schoolCountry].filter(Boolean).join(', ')
  const facebook = school?.socials?.facebook || ''
  const whatsapp = school?.socials?.whatsapp || schoolPhone
  const filename = `cartes_scolaires_${schoolName.toLowerCase().replace(/[^\w]+/g, '_')}_${Date.now()}.pdf`

  const container = document.createElement('div')
  container.id = 'export-carte-scolaire-container'
  container.style.cssText = `
    position: fixed; left: -9999px; top: 0; width: 800px; background: #ffffff;
    color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    padding: 20px; box-sizing: border-box;
  `

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

        return `
          <div style="width: 350px; height: 220px; border: 2px solid #2563eb; border-radius: 12px; padding: 10px; box-sizing: border-box; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; page-break-inside: avoid; box-shadow: 0 2px 4px rgba(0,0,0,0.06);">
            <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: #ffffff; padding: 6px 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <p style="font-size: 11px; font-weight: 800; margin: 0; text-transform: uppercase;">${schoolName}</p>
                <p style="font-size: 8px; margin: 1px 0 0 0; opacity: 0.95;">CARTE SCOLAIRE D'ÉLÈVE · ${s.academicYear || 'Année en cours'}</p>
              </div>
              <span style="font-size: 8px; font-weight: 700; background: #ffffff; color: #1e40af; padding: 2px 5px; border-radius: 3px;">${s.cycle || 'Général'}</span>
            </div>

            <div style="display: flex; gap: 10px; align-items: center; margin: 6px 0;">
              <div style="width: 65px; height: 75px; border-radius: 6px; background: #eff6ff; border: 1.5px solid #bfdbfe; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${s.photo ? `<img src="${s.photo}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="font-size: 22px; font-weight: bold; color: #3b82f6;">${(s.lastName || '?')[0]}</span>`}
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
              <span>KATD-SCHÜLE · Document officiel</span>
              <span style="font-weight: 700; color: #0f172a;">Le Directeur (Cachet & Signature)</span>
            </div>
          </div>
        `
      }).join('')}
    </div>
  `

  document.body.appendChild(container)
  const opt = {
    margin: [8, 8, 8, 8], filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }

  try {
    const blob = await html2pdf().set(opt).from(container).outputPdf('blob')
    triggerBlobDownload(blob, filename)
  } catch (_) {
    await html2pdf().set(opt).from(container).save()
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container)
  }
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
  container.style.cssText = `
    position: fixed; left: -9999px; top: 0; width: 800px; background: #ffffff;
    color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    padding: 24px 30px; box-sizing: border-box;
  `

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
        Total élèves en retard : ${summary.totalLateStudents || lateStudents.length} · Montant total restant dû : ${fmt(summary.totalLateAmount || 0)}
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
              <strong>${s.parentName}</strong>
              ${s.parentPhone ? `<br/><span style="color:#059669; font-weight: 600;">📞 ${s.parentPhone}</span>` : ''}
            </td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: right;">${fmt(s.totalDue)}</td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: right; color: #16a34a; font-weight: 600;">${fmt(s.totalPaid)}</td>
            <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: right; color: #dc2626; font-weight: 800;">${fmt(s.totalRemaining)}</td>
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

  document.body.appendChild(container)
  const opt = {
    margin: [8, 8, 8, 8], filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }

  try {
    const blob = await html2pdf().set(opt).from(container).outputPdf('blob')
    triggerBlobDownload(blob, filename)
  } catch (_) {
    await html2pdf().set(opt).from(container).save()
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container)
  }
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
  container.style.cssText = `
    position: fixed; left: -9999px; top: 0; width: 800px; background: #ffffff;
    color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    padding: 24px 30px; box-sizing: border-box;
  `

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

  document.body.appendChild(container)
  const opt = {
    margin: [8, 8, 8, 8], filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }

  try {
    const blob = await html2pdf().set(opt).from(container).outputPdf('blob')
    triggerBlobDownload(blob, filename)
  } catch (_) {
    await html2pdf().set(opt).from(container).save()
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container)
  }
}
