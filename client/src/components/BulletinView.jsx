import { Calendar, BarChart3, GraduationCap, Trophy, Users as UsersIcon, Star, User as UserIcon, Hash, CalendarDays, Smile } from 'lucide-react'

/**
 * Formal report card (bulletin) view — matches KATD-SCHÜLE design.
 * Print-friendly: clicking "Download" triggers window.print() — user picks "Save as PDF".
 */
export default function BulletinView({ data, schoolBranding = true }) {
  if (!data) return null
  const { school, student, class: klass, academicYear, term, subjects = [], generalAverage, appreciation, behavior, attendance = {}, classStats = {}, issuedAt } = data

  const formatDate = (d) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  const formatDateLong = (d) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const termNumber = term ? (term.match(/\d+/)?.[0] || '1') : '1'

  return (
    <div className="bulletin-doc">
      {/* HEADER */}
      <div className="bulletin-header">
        <div className="bulletin-logo-block">
          <div className="bulletin-logo">
            {school?.logo ? (
              <img src={school.logo} alt={school.name} />
            ) : (
              <div className="bulletin-logo-fallback"><span>K</span></div>
            )}
          </div>
          <div className="bulletin-title-block">
            <h1 className="bulletin-school-name">{school?.name || 'KATD-SCHÜLE'}</h1>
            <div className="bulletin-tagline">BORN TO LEAD</div>
          </div>
        </div>
        <div className="bulletin-year-box">
          <div className="bulletin-year-line">
            <Calendar size={11} />
            <div>
              <div className="bulletin-year-label">ANNÉE SCOLAIRE</div>
              <div className="bulletin-year-value">{academicYear || '—'}</div>
            </div>
          </div>
          <div className="bulletin-year-line">
            <CalendarDays size={11} />
            <div>
              <div className="bulletin-year-label">TRIMESTRE</div>
              <div className="bulletin-year-value">{termNumber}</div>
            </div>
          </div>
        </div>
      </div>

      {/* STUDENT INFO */}
      <div className="bulletin-section">
        <div className="bulletin-section-title">INFORMATIONS SUR L'ÉLÈVE</div>
        <div className="bulletin-student-grid">
          <div className="bulletin-photo">
            {student?.photo ? (
              <img src={student.photo} alt={`${student.firstName} ${student.lastName}`} crossOrigin="anonymous" />
            ) : (
              <div className="bulletin-photo-fallback"><UserIcon size={40} /></div>
            )}
          </div>
          <div className="bulletin-student-info">
            <InfoRow icon={<UserIcon size={13} />} label="Nom et prénom" value={`${student?.firstName || ''} ${student?.lastName || ''}`} />
            <InfoRow icon={<Hash size={13} />} label="Matricule" value={student?.matricule || '—'} />
            <InfoRow icon={<Calendar size={13} />} label="Date de naissance" value={formatDate(student?.dateOfBirth) || '—'} />
            <InfoRow icon={<GraduationCap size={13} />} label="Classe" value={klass?.name || '—'} />
            <InfoRow icon={<BarChart3 size={13} />} label="Niveau" value={klass?.level || klass?.cycle || '—'} />
          </div>
        </div>
      </div>

      {/* RESULTS TABLE */}
      <div className="bulletin-section">
        <div className="bulletin-section-title">RÉSULTATS SCOLAIRES</div>
        <table className="bulletin-table">
          <thead>
            <tr>
              <th>MATIÈRES</th>
              <th>COEF</th>
              <th>DEVOIR<br/><span className="th-sub">(/20)</span></th>
              <th>EXAMEN<br/><span className="th-sub">(/20)</span></th>
              <th>COMPO.<br/><span className="th-sub">(/20)</span></th>
              <th>ORAL<br/><span className="th-sub">(/20)</span></th>
              <th>TP<br/><span className="th-sub">(/20)</span></th>
              <th>MOYENNE<br/><span className="th-sub">(/20)</span></th>
              <th>APPRÉCIATION DE L'ENSEIGNANT</th>
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 ? (
              <tr><td colSpan={9} className="bulletin-empty">Aucune note enregistrée pour cette période</td></tr>
            ) : (
              subjects.map((s, i) => (
                <tr key={i}>
                  <td className="bulletin-subject-name">{s.name}</td>
                  <td>{s.coefficient}</td>
                  <TypeCell cell={s.byType?.devoir} />
                  <TypeCell cell={s.byType?.examen} />
                  <TypeCell cell={s.byType?.composition} />
                  <TypeCell cell={s.byType?.oral} />
                  <TypeCell cell={s.byType?.tp} />
                  <td className="bulletin-avg">{s.average != null ? s.average.toFixed(2) : '—'}</td>
                  <td className="bulletin-comment">{s.teacherComment}</td>
                </tr>
              ))
            )}
            <tr className="bulletin-row-total">
              <td colSpan={7}>MOYENNE GÉNÉRALE</td>
              <td className="bulletin-avg">{generalAverage != null ? generalAverage.toFixed(2) : '—'} <span className="bulletin-avg-unit">/20</span></td>
              <td className="bulletin-comment">{appreciation}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* PERFORMANCE RECAP */}
      <div className="bulletin-section">
        <div className="bulletin-section-title">RÉCAPITULATIF DES PERFORMANCES</div>
        <div className="bulletin-perf-grid">
          <PerfCell icon={<GraduationCap size={18} />} label="RANG DE L'ÉLÈVE" value={classStats.rank ? `${classStats.rank} / ${classStats.classSize}` : '—'} />
          <PerfCell icon={<UsersIcon size={18} />} label="MOYENNE DE LA CLASSE" value={classStats.classAverage != null ? `${classStats.classAverage.toFixed(2)} /20` : '—'} />
          <PerfCell icon={<Trophy size={18} />} label="MOYENNE DU PREMIER" value={classStats.topAverage != null ? `${classStats.topAverage.toFixed(2)} /20` : '—'} />
          <PerfCell icon={<BarChart3 size={18} />} label="MOYENNE DU DERNIER" value={classStats.bottomAverage != null ? `${classStats.bottomAverage.toFixed(2)} /20` : '—'} />
          <PerfCell icon={<Star size={18} />} label="EFFECTIF DE LA CLASSE" value={`${classStats.classSize || 0} élèves`} />
        </div>
      </div>

      {/* BEHAVIOR + ATTENDANCE */}
      <div className="bulletin-row-2col">
        <div className="bulletin-section bulletin-half">
          <div className="bulletin-section-title">COMPORTEMENT</div>
          <div className="bulletin-half-content"><Smile size={18} className="text-purple-700" /><span>{behavior || '—'}</span></div>
        </div>
        <div className="bulletin-section bulletin-half">
          <div className="bulletin-section-title">ASSIDUITÉ</div>
          <div className="bulletin-attendance">
            <div><Calendar size={11} /> Présence : <strong>{attendance.presentDays || 0} / {attendance.totalDays || 0} jours</strong></div>
            <div><span className="dot-absent" /> Absences : <strong>{attendance.absentCount || 0}</strong></div>
            <div><span className="dot-late" /> Retards : <strong>{attendance.lateCount || 0}</strong></div>
          </div>
        </div>
      </div>

      {/* GENERAL APPRECIATION */}
      <div className="bulletin-section">
        <div className="bulletin-section-title">APPRÉCIATION GÉNÉRALE DU PROFESSEUR PRINCIPAL</div>
        <div className="bulletin-appreciation">{appreciation}</div>
      </div>

      {/* SIGNATURES */}
      <div className="bulletin-signatures">
        <div className="bulletin-sig-block">
          <div className="bulletin-sig-icon"><Calendar size={14} /></div>
          <div>
            <div className="bulletin-sig-label">Date d'édition</div>
            <div className="bulletin-sig-value">{formatDateLong(issuedAt) || formatDateLong(new Date())}</div>
          </div>
        </div>
        <div className="bulletin-sig-block bulletin-sig-line">
          <div className="bulletin-sig-label">Signature du Professeur Principal</div>
          <div className="bulletin-sig-line-empty" />
        </div>
        <div className="bulletin-sig-block bulletin-sig-line">
          <div className="bulletin-sig-label">Signature du Chef d'Établissement</div>
          <div className="bulletin-sig-line-empty" />
        </div>
        {schoolBranding && (
          <div className="bulletin-stamp">
            <div className="bulletin-stamp-circle">{school?.name?.charAt(0) || 'K'}</div>
            <div className="bulletin-stamp-text">{school?.name || 'KATD-SCHÜLE'}</div>
          </div>
        )}
      </div>

      <div className="bulletin-footer">Ce bulletin n'est valable que pour le trimestre indiqué.</div>

      <style>{`
        .bulletin-doc { background: #fff; color: #111827; max-width: 820px; margin: 0 auto; padding: 18px 22px 28px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; box-shadow: 0 4px 24px rgba(0,0,0,.06); border-radius: 8px; }
        .bulletin-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; border-bottom: 2px solid #1E1B4B; margin-bottom: 14px; }
        .bulletin-logo-block { display: flex; align-items: center; gap: 14px; }
        .bulletin-logo { width: 64px; height: 64px; }
        .bulletin-logo img { width: 100%; height: 100%; object-fit: contain; }
        .bulletin-logo-fallback { width: 64px; height: 64px; background: #1E1B4B; color: #FBBF24; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 32px; }
        .bulletin-title-block { line-height: 1.1; }
        .bulletin-school-name { font-size: 22px; font-weight: 900; color: #1E1B4B; letter-spacing: 1px; margin: 0; }
        .bulletin-tagline { font-size: 11px; color: #C58B1B; font-weight: 700; letter-spacing: 4px; margin-top: 2px; }
        .bulletin-year-box { background: #EEF2FF; border-radius: 8px; padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; min-width: 160px; }
        .bulletin-year-line { display: flex; align-items: center; gap: 6px; color: #1E1B4B; }
        .bulletin-year-label { font-size: 9px; font-weight: 700; color: #4338CA; letter-spacing: .5px; }
        .bulletin-year-value { font-size: 13px; font-weight: 700; color: #1E1B4B; }

        .bulletin-section { margin-bottom: 12px; border: 1px solid #C7D2FE; border-radius: 8px; overflow: hidden; }
        .bulletin-section-title { background: #312E81; color: #fff; padding: 6px 12px; font-weight: 700; font-size: 11px; letter-spacing: .5px; }

        .bulletin-student-grid { display: grid; grid-template-columns: 130px 1fr; gap: 14px; padding: 12px; }
        .bulletin-photo { width: 120px; height: 130px; border-radius: 8px; overflow: hidden; background: #E0E7FF; }
        .bulletin-photo img { width: 100%; height: 100%; object-fit: cover; }
        .bulletin-photo-fallback { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #6366F1; }
        .bulletin-student-info { display: flex; flex-direction: column; justify-content: center; gap: 6px; }

        .bulletin-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .bulletin-table thead th { background: #EEF2FF; color: #1E1B4B; padding: 5px 4px; text-align: center; font-weight: 700; font-size: 9px; border-right: 1px solid #C7D2FE; }
        .bulletin-table thead th:last-child { border-right: none; text-align: left; }
        .bulletin-table .th-sub { font-weight: 400; font-size: 8px; color: #6366F1; }
        .bulletin-table tbody td { padding: 6px 4px; text-align: center; border-top: 1px solid #E0E7FF; border-right: 1px solid #E0E7FF; }
        .bulletin-table tbody td:last-child { border-right: none; text-align: left; font-style: italic; color: #4B5563; }
        .bulletin-subject-name { text-align: left !important; font-weight: 600; color: #1E1B4B; }
        .bulletin-type-cell { white-space: nowrap; }
        .bulletin-type-avg { font-weight: 700; color: #1E1B4B; font-size: 11px; }
        .bulletin-note-detail { font-size: 8px; color: #9CA3AF; font-weight: 400; margin-top: 1px; font-style: normal; }
        .bulletin-avg { font-weight: 800; color: #4F46E5; font-size: 12px; }
        .bulletin-avg-unit { color: #9CA3AF; font-weight: 400; font-size: 10px; }
        .bulletin-comment { color: #4B5563; }
        .bulletin-empty { color: #9CA3AF; padding: 16px !important; text-align: center !important; }
        .bulletin-row-total { background: #EEF2FF; }
        .bulletin-row-total td { font-weight: 800; color: #1E1B4B; }

        .bulletin-perf-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; padding: 0; }
        .bulletin-perf-cell { padding: 10px 6px; text-align: center; border-right: 1px solid #E0E7FF; }
        .bulletin-perf-cell:last-child { border-right: none; }
        .bulletin-perf-icon { color: #4F46E5; margin: 0 auto 4px; }
        .bulletin-perf-label { font-size: 8px; font-weight: 700; color: #6B7280; letter-spacing: .5px; }
        .bulletin-perf-value { font-size: 13px; font-weight: 800; color: #1E1B4B; margin-top: 2px; }

        .bulletin-row-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
        .bulletin-half { margin-bottom: 0; }
        .bulletin-half-content { padding: 12px; display: flex; align-items: center; gap: 8px; font-weight: 600; color: #1E1B4B; }
        .bulletin-attendance { padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: #374151; }
        .bulletin-attendance div { display: flex; align-items: center; gap: 6px; }
        .dot-absent { width: 8px; height: 8px; border-radius: 50%; background: #DC2626; }
        .dot-late { width: 8px; height: 8px; border-radius: 50%; background: #D97706; }

        .bulletin-appreciation { padding: 12px; font-style: italic; color: #1F2937; line-height: 1.5; }

        .bulletin-signatures { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 16px; padding: 16px 8px; align-items: end; }
        .bulletin-sig-block { display: flex; align-items: center; gap: 8px; }
        .bulletin-sig-icon { color: #4F46E5; }
        .bulletin-sig-label { font-size: 10px; color: #6B7280; }
        .bulletin-sig-value { font-size: 11px; font-weight: 600; color: #1F2937; }
        .bulletin-sig-line { flex-direction: column; align-items: flex-start; gap: 4px; }
        .bulletin-sig-line-empty { width: 100%; border-top: 1px solid #1E1B4B; padding-top: 4px; min-height: 30px; }
        .bulletin-stamp { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .bulletin-stamp-circle { width: 56px; height: 56px; border-radius: 50%; border: 2px solid #1E1B4B; display: flex; align-items: center; justify-content: center; color: #1E1B4B; font-weight: 900; font-size: 24px; background: #FEF3C7; }
        .bulletin-stamp-text { font-size: 8px; color: #1E1B4B; font-weight: 700; letter-spacing: .5px; }

        .bulletin-footer { text-align: center; font-size: 10px; color: #6B7280; font-style: italic; margin-top: 4px; }

        @media print {
          @page { size: A4; margin: 10mm; }
          body * { visibility: hidden; }
          .bulletin-doc, .bulletin-doc * { visibility: visible; }
          .bulletin-doc { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}

function TypeCell({ cell }) {
  if (!cell || cell.count === 0) return <td className="bulletin-type-cell">—</td>
  return (
    <td className="bulletin-type-cell">
      <div className="bulletin-type-avg">{cell.avg != null ? cell.avg : '—'}</div>
      {cell.values.length > 0 && (
        <div className="bulletin-note-detail">({cell.values.join(', ')})</div>
      )}
    </td>
  )
}

function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
      <span style={{ background: '#E0E7FF', borderRadius: 4, padding: '2px 6px', color: '#4F46E5' }}>{icon}</span>
      <span style={{ color: '#6B7280', minWidth: 130 }}>{label} :</span>
      <strong style={{ color: '#1F2937' }}>{value}</strong>
    </div>
  )
}

function PerfCell({ icon, label, value }) {
  return (
    <div className="bulletin-perf-cell">
      <div className="bulletin-perf-icon">{icon}</div>
      <div className="bulletin-perf-label">{label}</div>
      <div className="bulletin-perf-value">{value}</div>
    </div>
  )
}
