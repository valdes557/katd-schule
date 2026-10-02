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
