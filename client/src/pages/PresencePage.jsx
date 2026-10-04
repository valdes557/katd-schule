import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import {
  CalendarCheck, Check, X, Clock, AlertCircle, Loader2,
  Save, QrCode, Camera, CheckCircle2, Send, ListChecks,
  TrendingUp, Calendar, UserCheck, Users
} from 'lucide-react'
import { attendanceApi, classesApi, studentsApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { cn } from '../lib/utils'
import DownloadPdfButton from '../components/DownloadPdfButton'

const QR_SCANNER_ID = 'presence-qr-region'

const statusOptions = [
  { key: 'present', label: 'Présent', icon: Check, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-300' },
  { key: 'absent', label: 'Absent', icon: X, color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-300' },
  { key: 'late', label: 'Retard', icon: Clock, color: 'text-orange-500', bg: 'bg-orange-100', border: 'border-orange-300' },
  { key: 'excused', label: 'Justifié', icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-300' },
]

export default function PresencePage() {
  const pdfRef = useRef(null)
  const [activeTab, setActiveTab] = useState('journalier') // 'journalier' | 'fiche_hebdo' | 'bilans'
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [records, setRecords] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  // Appel par QR : le professeur scanne les QR individuels des élèves de la classe
  const [qrMode, setQrMode] = useState(false)
  const [qrLast, setQrLast] = useState(null) // { ok, name, message, at }
  const [qrScanned, setQrScanned] = useState([]) // élèves scannés durant la session
  const qrScannerRef = useRef(null)
  const qrRecentRef = useRef(new Map()) // anti-rebond : qrId → timestamp
  const qrClassRef = useRef('') // classe active côté callback caméra

  const classesQ = useCachedFetch('/classes?', async () => (await classesApi.list()).data || [], [])
  const classes = classesQ.data || []

  // Sélectionne la première classe une fois les classes chargées.
  useEffect(() => {
    if (!selectedClass && classes.length > 0) setSelectedClass(classes[0]._id)
  }, [classes, selectedClass])

  const cls = selectedClass
  const studentsQ = useCachedFetch(
    cls ? `/students?classId=${cls}` : null,
    async () => (await studentsApi.list(`classId=${cls}`)).data || [],
    [cls],
  )
  const historyQ = useCachedFetch(
    cls ? `/attendance?classId=${cls}&limit=10` : null,
    async () => (await attendanceApi.list(`classId=${cls}&limit=10`)).data || [],
    [cls],
  )
  const statsQ = useCachedFetch(
    cls ? `/attendance/stats?classId=${cls}` : null,
    async () => (await attendanceApi.stats(`classId=${cls}`)).data || null,
    [cls],
  )

  const students = studentsQ.data || []
  const history = historyQ.data || []
  const stats = statsQ.data
  const loading = classesQ.loading || studentsQ.loading

  // records est DÉRIVÉ (pas mis en cache) : recalculé quand students/history/date changent.
  useEffect(() => {
    const todayRecord = history.find(
      (a) => new Date(a.date).toISOString().slice(0, 10) === selectedDate
    )
    const initial = {}
    students.forEach((s) => {
      const existing = todayRecord?.records?.find((r) => (r.student?._id || r.student) === s._id)
      initial[s._id] = existing?.status || 'present'
    })
    setRecords(initial)
  }, [students, history, selectedDate])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const data = {
        classId: selectedClass,
        date: selectedDate,
        records: Object.entries(records).map(([student, status]) => ({ student, status })),
      }
      await attendanceApi.save(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      cache.invalidate('/attendance')
      historyQ.refetch()
      statsQ.refetch()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  // ── Appel par QR ──
  useEffect(() => { qrClassRef.current = selectedClass }, [selectedClass])
  useEffect(() => () => { stopQrScanner() }, [])

  const stopQrScanner = async () => {
    const s = qrScannerRef.current
    if (s) {
      try { await s.stop() } catch (_) {}
      try { await s.clear() } catch (_) {}
      qrScannerRef.current = null
    }
    setQrMode(false)
  }

  const onQrScan = async (decodedText) => {
    const qrId = (decodedText || '').trim()
    if (!qrId) return
    // Anti-rebond : ignore le même QR pendant 5 secondes (la caméra lit en continu)
    const lastSeen = qrRecentRef.current.get(qrId)
    if (lastSeen && Date.now() - lastSeen < 5000) return
    qrRecentRef.current.set(qrId, Date.now())

    try {
      const r = await attendanceApi.resolveQr(qrId, qrClassRef.current)
      const d = r.data || {}
      // Marque l'élève présent dans la grille d'appel
      setRecords((prev) => ({ ...prev, [d.id]: 'present' }))
      const entry = { ok: true, name: d.name, at: new Date() }
      setQrLast(entry)
      setQrScanned((prev) => [entry, ...prev.filter((p) => p.name !== d.name)].slice(0, 40))
    } catch (e) {
      setQrLast({ ok: false, message: e.message, at: new Date() })
    }
  }

  const startQrScanner = async () => {
    if (!selectedClass) { alert("Sélectionnez d'abord une classe"); return }
    // Démarre l'appel : tout le monde absent, chaque scan repasse l'élève en présent
    setRecords((prev) => Object.fromEntries(Object.keys(prev).map((id) => [id, 'absent'])))
    setQrLast(null)
    setQrScanned([])
    setQrMode(true)
    setTimeout(async () => {
      try {
        const html5 = new Html5Qrcode(QR_SCANNER_ID)
        qrScannerRef.current = html5
        await html5.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          onQrScan,
          () => {} // ignore les échecs de lecture intermédiaires
        )
      } catch (e) {
        setQrMode(false)
        setQrLast({ ok: false, message: "Impossible d'accéder à la caméra. Autorisez l'accès et réessayez." })
      }
    }, 100)
  }

  const summary = {
    present: Object.values(records).filter((v) => v === 'present').length,
    absent: Object.values(records).filter((v) => v === 'absent').length,
    late: Object.values(records).filter((v) => v === 'late').length,
    excused: Object.values(records).filter((v) => v === 'excused').length,
  }

  const filteredStudents = filterStatus
    ? students.filter((s) => records[s._id] === filterStatus)
    : []

  return (
    <div className="space-y-5 animate-fade-in" ref={pdfRef}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarCheck size={22} className="text-green-600" /> Gestion de la Présence
          </h1>
          <p className="text-sm text-gray-500">Appel journalier, fiche hebdomadaire par cours et bilans d'assiduité</p>
        </div>
        {activeTab === 'journalier' && (
          <DownloadPdfButton containerRef={pdfRef} filename="presences.pdf" title="Présences" label="Présences PDF" />
        )}
      </div>

      {/* Navigation Onglets */}
      <div className="flex border-b border-gray-200 gap-1 sm:gap-2">
        <button
          onClick={() => setActiveTab('journalier')}
          className={cn(
            'flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'journalier'
              ? 'border-green-600 text-green-700 bg-green-50/50 rounded-t-lg'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          )}
        >
          <CalendarCheck size={16} /> Appel journalier & QR
        </button>
        <button
          onClick={() => setActiveTab('fiche_hebdo')}
          className={cn(
            'flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'fiche_hebdo'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          )}
        >
          <ListChecks size={16} /> Fiche d'appel hebdomadaire (par cours)
        </button>
        <button
          onClick={() => setActiveTab('bilans')}
          className={cn(
            'flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'bilans'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-lg'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          )}
        >
          <TrendingUp size={16} /> Bilans & Assiduité
        </button>
      </div>

      {activeTab === 'journalier' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input text-sm w-auto">
              <option value="">Choisir une classe</option>
              {classes.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.level})</option>)}
            </select>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="input text-sm w-auto" />
            {!qrMode && (
              <button onClick={startQrScanner} className="btn-ghost border border-indigo-200 text-indigo-600 text-sm flex items-center gap-1.5">
                <QrCode size={15} /> Appel par QR
              </button>
            )}
          </div>

          {/* Appel par QR : caméra + feedback */}
          {(qrMode || qrLast) && (
            <div className="card p-4 space-y-3">
              {qrLast && (
                <div className={`flex items-center gap-2 border-l-4 pl-3 py-1 ${qrLast.ok ? 'border-l-green-500' : 'border-l-red-500'}`}>
                  {qrLast.ok
                    ? <><CheckCircle2 size={18} className="text-green-600" /><p className="text-sm font-semibold text-gray-900">{qrLast.name} <span className="text-green-600 font-bold">présent(e)</span></p></>
                    : <><AlertCircle size={18} className="text-red-500" /><p className="text-sm text-red-600">{qrLast.message}</p></>}
                </div>
              )}
              {qrMode && (
                <div>
                  <div id={QR_SCANNER_ID} className="w-full max-w-md mx-auto rounded-xl overflow-hidden" />
                  <p className="text-center text-xs text-gray-400 mt-2">
                    Scannez le QR de chaque élève : il est marqué présent. Les non-scannés restent absents.
                    {qrScanned.length > 0 && <span className="font-semibold text-gray-600"> {qrScanned.length} scanné(s)</span>}
                  </p>
                  <button onClick={stopQrScanner} className="btn-ghost border border-gray-200 w-full justify-center text-sm mt-3 flex items-center gap-1.5">
                    <Camera size={14} /> Arrêter le scan (puis Enregistrer l'appel)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {statusOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFilterStatus((prev) => (prev === opt.key ? '' : opt.key))}
                className={cn(
                  'card p-3 border text-left transition-colors',
                  opt.border,
                  filterStatus === opt.key ? 'ring-2 ring-offset-1 ring-blue-400' : ''
                )}
              >
                <div className={cn('text-2xl font-bold', opt.color)}>{summary[opt.key]}</div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  {opt.label}s
                  {filterStatus === opt.key && <span className="text-[10px] text-blue-600 font-semibold">(cliqué)</span>}
                </div>
              </button>
            ))}
          </div>

          {filterStatus && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                Élèves {statusOptions.find((o) => o.key === filterStatus)?.label.toLowerCase()}s ({filteredStudents.length})
              </h3>
              {filteredStudents.length === 0 ? (
                <p className="text-xs text-gray-400">Aucun élève dans ce statut pour cette date.</p>
              ) : (
                <ul className="text-xs text-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4">
                  {filteredStudents.map((s) => (
                    <li key={s._id}>{s.lastName} {s.firstName}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Stats */}
          {stats && stats.totalSessions > 0 && (
            <div className="card p-4 bg-gray-50">
              <div className="flex flex-wrap gap-6 text-sm">
                <div><span className="text-gray-500">Sessions:</span> <span className="font-bold">{stats.totalSessions}</span></div>
                <div><span className="text-gray-500">Taux présence:</span> <span className="font-bold text-green-600">{stats.attendanceRate}%</span></div>
                <div><span className="text-gray-500">Total absences:</span> <span className="font-bold text-red-600">{stats.totalAbsent}</span></div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
          ) : !selectedClass ? (
            <div className="text-center py-16 text-gray-400"><p>Sélectionnez une classe pour faire l'appel</p></div>
          ) : students.length === 0 ? (
            <div className="text-center py-16 text-gray-400"><AlertCircle size={36} className="mx-auto mb-3 opacity-30" /><p>Aucun élève dans cette classe</p></div>
          ) : (
            <>
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Élève</th>
                      {statusOptions.map((o) => (
                        <th key={o.key} className="text-center text-xs font-semibold text-gray-500 px-2 py-3">{o.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {students.map((s) => (
                      <tr key={s._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.lastName} {s.firstName}</td>
                        {statusOptions.map((opt) => (
                          <td key={opt.key} className="text-center px-2 py-3">
                            <button
                              onClick={() => setRecords({ ...records, [s._id]: opt.key })}
                              className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center transition-all mx-auto',
                                records[s._id] === opt.key ? `${opt.bg} ${opt.color} ring-2 ring-offset-1 ${opt.border}` : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              )}
                            >
                              <opt.icon size={14} />
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {saving ? 'Enregistrement...' : 'Enregistrer l\'appel'}
                </button>
                {saved && <span className="text-sm text-green-600 font-medium">✓ Appel enregistré avec succès</span>}
              </div>
            </>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Historique récent</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {['Date', 'Classe', 'Présents', 'Absents', 'Retards', 'Justifiés'].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {history.map((h) => (
                      <tr key={h._id} className="hover:bg-gray-50 text-sm">
                        <td className="px-4 py-2 text-gray-600">{new Date(h.date).toLocaleDateString('fr-FR')}</td>
                        <td className="px-4 py-2 text-gray-900 font-medium">{h.class?.name || '—'}</td>
                        <td className="px-4 py-2 text-green-600 font-bold">{h.summary?.present || 0}</td>
                        <td className="px-4 py-2 text-red-600 font-bold">{h.summary?.absent || 0}</td>
                        <td className="px-4 py-2 text-orange-500">{h.summary?.late || 0}</td>
                        <td className="px-4 py-2 text-blue-600">{h.summary?.excused || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'fiche_hebdo' && (
        <WeeklyCallSheetView classes={classes} defaultClass={selectedClass} />
      )}

      {activeTab === 'bilans' && (
        <AbsenceStatsView classes={classes} defaultClass={selectedClass} />
      )}
    </div>
  )
}

function WeeklyCallSheetView({ classes, defaultClass }) {
  const [classId, setClassId] = useState(defaultClass || '')
  const [weekDate, setWeekDate] = useState(new Date().toISOString().slice(0, 10))
  const [sheet, setSheet] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [searchStudent, setSearchStudent] = useState('')
  const [transmitting, setTransmitting] = useState(false)
  const [transmittingSuccess, setTransmittingSuccess] = useState('')

  useEffect(() => {
    if (defaultClass && !classId) setClassId(defaultClass)
  }, [defaultClass])

  const loadSheet = async () => {
    if (!classId) return
    setLoading(true)
    try {
      const res = await attendanceApi.weeklySheet(classId, weekDate)
      const data = res.data || res
      setSheet(data)
      if (data.students?.length > 0) {
        setSelectedStudent((prev) => {
          if (prev && data.students.some((s) => s._id === prev._id)) return prev
          return data.students[0]
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSheet()
  }, [classId, weekDate])

  const toggleCourseAbsence = async (day, slot) => {
    if (!selectedStudent || !sheet) return
    const sId = selectedStudent._id
    const dStr = day.dateStr
    const currentIsAbsent = !!sheet.studentAbsences?.[sId]?.[dStr]?.slotAbsences?.[slot._id]
    const nextIsAbsent = !currentIsAbsent

    // Mise à jour optimiste immédiate dans l'état local
    setSheet((prev) => {
      if (!prev) return prev
      const newAbsences = { ...prev.studentAbsences }
      if (!newAbsences[sId]) newAbsences[sId] = {}
      if (!newAbsences[sId][dStr]) newAbsences[sId][dStr] = { status: 'present', slotAbsences: {} }
      const newSlotAbsences = { ...(newAbsences[sId][dStr].slotAbsences || {}) }
      newSlotAbsences[slot._id] = nextIsAbsent
      newAbsences[sId][dStr] = {
        ...newAbsences[sId][dStr],
        slotAbsences: newSlotAbsences,
      }
      return { ...prev, studentAbsences: newAbsences }
    })

    try {
      await attendanceApi.weeklyCourseAbsence({
        classId,
        studentId: sId,
        date: dStr,
        slotId: slot._id,
        day: day.name,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subject: slot.subject || slot.title || '',
        isAbsent: nextIsAbsent,
      })
    } catch (err) {
      alert('Erreur lors de l\'enregistrement de l\'absence : ' + err.message)
      loadSheet()
    }
  }

  const handleTransmit = async () => {
    if (!classId || !sheet) return
    if (!confirm('Transmettre la fiche d\'appel de cette semaine à la direction de l\'établissement ?')) return
    setTransmitting(true)
    setTransmittingSuccess('')
    try {
      await attendanceApi.transmitWeeklySheet({ classId, weekStartDate: sheet.weekStart })
      setTransmittingSuccess('✓ Fiche d\'appel hebdomadaire transmise avec succès à la direction !')
      setSheet((prev) => prev ? { ...prev, isTransmitted: true } : prev)
      setTimeout(() => setTransmittingSuccess(''), 5000)
    } catch (err) {
      alert(err.message)
    } finally {
      setTransmitting(false)
    }
  }

  const students = sheet?.students || []
  const filteredStudents = students.filter((s) => {
    if (!searchStudent) return true
    const q = searchStudent.toLowerCase()
    return `${s.lastName} ${s.firstName} ${s.matricule || ''}`.toLowerCase().includes(q)
  })

  const getMissedSlotsCount = (studentId) => {
    if (!sheet?.studentAbsences?.[studentId]) return 0
    let count = 0
    Object.values(sheet.studentAbsences[studentId]).forEach((dayData) => {
      if (dayData.slotAbsences) {
        Object.values(dayData.slotAbsences).forEach((val) => {
          if (val === true) count++
        })
      }
    })
    return count
  }

  return (
    <div className="space-y-4">
      {/* Barre d'outils Fiche Hebdo */}
      <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase">Classe</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="input text-sm w-auto font-medium"
            >
              <option value="">Sélectionner une classe</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>{c.name} ({c.level})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase">Semaine (Date de référence)</label>
            <input
              type="date"
              value={weekDate}
              onChange={(e) => setWeekDate(e.target.value)}
              className="input text-sm w-auto font-medium"
            />
          </div>

          {sheet && (
            <div className="self-end pb-1 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
              📅 <span className="font-semibold">Semaine du :</span> {new Date(sheet.weekStart).toLocaleDateString('fr-FR')} au {new Date(sheet.weekEnd).toLocaleDateString('fr-FR')}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          {sheet?.isTransmitted ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 text-xs font-bold">
              <CheckCircle2 size={15} /> Fiche transmise à la direction
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
              <Clock size={15} /> Non transmise
            </span>
          )}

          <button
            onClick={handleTransmit}
            disabled={transmitting || !classId || students.length === 0}
            className="btn-primary text-xs sm:text-sm flex items-center gap-2"
          >
            {transmitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Transmettre à la direction
          </button>
        </div>
      </div>

      {transmittingSuccess && (
        <div className="card p-3 bg-green-50 border border-green-200 text-green-800 text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 size={18} className="text-green-600" />
          {transmittingSuccess}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16"><Loader2 size={28} className="animate-spin mx-auto text-blue-600" /></div>
      ) : !classId ? (
        <div className="text-center py-16 text-gray-400">Veuillez choisir une classe pour afficher la fiche hebdomadaire.</div>
      ) : students.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Aucun élève trouvé dans cette classe.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Colonne Gauche : Liste des élèves de la classe */}
          <div className="lg:col-span-4 card p-4 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <Users size={16} className="text-blue-600" /> Liste des élèves ({filteredStudents.length})
              </h3>
            </div>

            <input
              type="text"
              placeholder="Rechercher un élève..."
              value={searchStudent}
              onChange={(e) => setSearchStudent(e.target.value)}
              className="input text-xs w-full"
            />

            <div className="max-h-[620px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-gray-50">
              {filteredStudents.map((st) => {
                const missedCount = getMissedSlotsCount(st._id)
                const isSelected = selectedStudent?._id === st._id

                return (
                  <button
                    key={st._id}
                    type="button"
                    onClick={() => setSelectedStudent(st)}
                    className={cn(
                      'w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-2',
                      isSelected
                        ? 'bg-blue-50/90 border-2 border-blue-500 shadow-xs'
                        : 'hover:bg-gray-50 border border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                        {st.photo ? (
                          <img src={st.photo} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          st.firstName?.charAt(0) || 'E'
                        )}
                      </div>
                      <div className="truncate">
                        <p className={cn('text-xs font-bold truncate', isSelected ? 'text-blue-900' : 'text-gray-900')}>
                          {st.lastName} {st.firstName}
                        </p>
                        <p className="text-[10px] text-gray-400">{st.matricule || 'Sans matricule'}</p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {missedCount > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                          {missedCount} cours manqué{missedCount > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700">
                          Assidu
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Colonne Droite : Emploi du temps & pointage des cours de l'élève sélectionné */}
          <div className="lg:col-span-8 space-y-4">
            {selectedStudent ? (
              <div className="card p-5 space-y-4 bg-white border border-gray-100 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
                  <div>
                    <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">Fiche individuelle de pointage</span>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <UserCheck size={20} className="text-blue-600" />
                      {selectedStudent.lastName} {selectedStudent.firstName}
                      <span className="text-xs font-normal text-gray-400">({selectedStudent.matricule || 'N/A'})</span>
                    </h2>
                    <p className="text-xs text-gray-500">
                      Cochez les cours précis auxquels l'élève était absent. L'absence est automatiquement enregistrée.
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-gray-500">Total manqué cette semaine</div>
                    <div className={cn('text-lg font-black', getMissedSlotsCount(selectedStudent._id) > 0 ? 'text-red-600' : 'text-green-600')}>
                      {getMissedSlotsCount(selectedStudent._id)} cours
                    </div>
                  </div>
                </div>

                {/* Grille des journées et des créneaux de cours */}
                <div className="space-y-4">
                  {(sheet?.weekDays || []).map((day) => {
                    const slots = day.slots || []

                    return (
                      <div key={day.dateStr} className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50/40">
                        <div className="px-4 py-2.5 bg-gray-100/80 border-b border-gray-200 flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-800">
                            {day.name} {new Date(day.dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {slots.length} cours programmé{slots.length > 1 ? 's' : ''}
                          </span>
                        </div>

                        <div className="p-3">
                          {slots.length === 0 ? (
                            <p className="text-xs text-gray-400 italic py-1 text-center">Aucun cours programmé dans l'agenda pour ce jour.</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              {slots.map((slot) => {
                                const isAbsent = !!sheet.studentAbsences?.[selectedStudent._id]?.[day.dateStr]?.slotAbsences?.[slot._id]

                                return (
                                  <div
                                    key={slot._id}
                                    className={cn(
                                      'p-3 rounded-lg border transition-all flex items-center justify-between gap-2',
                                      isAbsent
                                        ? 'bg-red-50/90 border-red-300 text-red-950 shadow-xs'
                                        : 'bg-white border-gray-200 text-gray-800 hover:border-blue-200'
                                    )}
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-xs truncate">
                                          {slot.subject || slot.title || 'Cours'}
                                        </span>
                                        {slot.type === 'evaluation' && (
                                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">ÉVAL</span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                                        <Clock size={11} /> {slot.startTime} - {slot.endTime}
                                        {slot.room ? ` · Salle ${slot.room}` : ''}
                                      </p>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => toggleCourseAbsence(day, slot)}
                                      className={cn(
                                        'px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 transition-all',
                                        isAbsent
                                          ? 'bg-red-600 text-white hover:bg-red-700 shadow-xs'
                                          : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700'
                                      )}
                                      title={isAbsent ? 'Cliquer pour marquer présent' : 'Cliquer pour marquer absent'}
                                    >
                                      {isAbsent ? (
                                        <>
                                          <X size={13} />
                                          Absent
                                        </>
                                      ) : (
                                        <>
                                          <Check size={13} className="text-green-600" />
                                          Présent
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="card p-12 text-center text-gray-400">
                Sélectionnez un élève dans la liste de gauche pour pointer ses présences par cours.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AbsenceStatsView({ classes, defaultClass }) {
  const [classId, setClassId] = useState(defaultClass || '')
  const [students, setStudents] = useState([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [statsData, setStatsData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (defaultClass && !classId) setClassId(defaultClass)
  }, [defaultClass])

  useEffect(() => {
    if (!classId) return
    studentsApi.list(`classId=${classId}`).then((res) => {
      const list = res.data || []
      setStudents(list)
      if (list.length > 0) {
        setSelectedStudentId(list[0]._id)
      }
    }).catch(console.error)
  }, [classId])

  useEffect(() => {
    if (!selectedStudentId) return
    setLoading(true)
    attendanceApi.studentStats(selectedStudentId).then((res) => {
      setStatsData(res.data || res)
    }).catch(console.error).finally(() => setLoading(false))
  }, [selectedStudentId])

  const selectedStudent = students.find((s) => s._id === selectedStudentId)

  return (
    <div className="space-y-4">
      {/* Contrôles de sélection */}
      <div className="card p-4 flex flex-wrap items-center gap-3 bg-white">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase">Classe</label>
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value)
              setSelectedStudentId('')
            }}
            className="input text-sm w-auto font-medium"
          >
            <option value="">Sélectionner une classe</option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>{c.name} ({c.level})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase">Élève</label>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="input text-sm w-auto font-medium"
          >
            <option value="">Sélectionner un élève</option>
            {students.map((s) => (
              <option key={s._id} value={s._id}>{s.lastName} {s.firstName} ({s.matricule || 'N/A'})</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 size={28} className="animate-spin mx-auto text-blue-600" /></div>
      ) : !selectedStudentId || !statsData ? (
        <div className="text-center py-16 text-gray-400">Veuillez sélectionner un élève pour afficher son bilan d'assiduité.</div>
      ) : (
        <div className="space-y-5">
          {/* Métriques globales de l'élève */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4 bg-white border border-gray-100 shadow-xs">
              <span className="text-xs text-gray-500 font-medium">Taux d'assiduité global</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={cn(
                  'text-3xl font-black',
                  statsData.summary?.assiduiteRate >= 90 ? 'text-green-600' :
                  statsData.summary?.assiduiteRate >= 75 ? 'text-amber-600' : 'text-red-600'
                )}>
                  {statsData.summary?.assiduiteRate ?? 100}%
                </span>
                <span className="text-xs text-gray-400">sur l'année</span>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    statsData.summary?.assiduiteRate >= 90 ? 'bg-green-500' :
                    statsData.summary?.assiduiteRate >= 75 ? 'bg-amber-500' : 'bg-red-500'
                  )}
                  style={{ width: `${Math.min(100, statsData.summary?.assiduiteRate ?? 100)}%` }}
                />
              </div>
            </div>

            <div className="card p-4 bg-white border border-gray-100 shadow-xs">
              <span className="text-xs text-gray-500 font-medium">Cours suivis</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl font-black text-blue-600">{statsData.summary?.followedCourses ?? 0}</span>
                <span className="text-xs text-gray-400">cours dispensés</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Présent aux cours programmés</p>
            </div>

            <div className="card p-4 bg-white border border-gray-100 shadow-xs">
              <span className="text-xs text-gray-500 font-medium">Cours manqués</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl font-black text-red-600">{statsData.summary?.missedCourseSlotsCount ?? 0}</span>
                <span className="text-xs text-gray-400">créneau(x)</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Absences enregistrées sur l'agenda</p>
            </div>

            <div className="card p-4 bg-white border border-gray-100 shadow-xs">
              <span className="text-xs text-gray-500 font-medium">Jours d'absence</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl font-black text-orange-600">{statsData.summary?.totalAbsentDays ?? 0}</span>
                <span className="text-xs text-gray-400">sur {statsData.summary?.totalSessions ?? 0} jour(s)</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Appels journaliers avec absence</p>
            </div>
          </div>

          {/* Bilan mensuel */}
          <div className="card p-5 bg-white border border-gray-100 shadow-xs">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-indigo-600" /> Bilan mensuel des absences de l'élève
            </h3>
            {Object.keys(statsData.monthlyStats || {}).length === 0 ? (
              <p className="text-xs text-gray-400 py-3">Aucune donnée mensuelle enregistrée.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Mois</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Séances pointées</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Jours d'absence</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Cours / créneaux manqués</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {Object.entries(statsData.monthlyStats).map(([monthKey, m]) => (
                      <tr key={monthKey} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-bold text-gray-800">{monthKey}</td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{m.total}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-red-600">{m.absent}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-orange-600">{m.missedCourses}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Synthèse de l'assiduité pour toute la classe */}
          <div className="card p-5 bg-white border border-gray-100 shadow-xs">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Users size={16} className="text-blue-600" /> Synthèse d'assiduité de toute la classe ({students.length} élèves)
            </h3>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Élève</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Matricule</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {students.map((st) => (
                    <tr
                      key={st._id}
                      className={cn(
                        'hover:bg-gray-50',
                        st._id === selectedStudentId ? 'bg-blue-50/50' : ''
                      )}
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        {st.lastName} {st.firstName}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{st.matricule || '—'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedStudentId(st._id)}
                          className="btn-ghost text-[11px] px-2.5 py-1 border border-gray-200 text-blue-600 hover:bg-blue-50"
                        >
                          Voir le bilan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
