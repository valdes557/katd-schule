import { useState } from 'react'
import { CalendarCheck, Check, X, Clock, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { students } from '../data/mockData'
import { cn } from '../lib/utils'

const statusOptions = [
  { key: 'present', label: 'Présent', icon: Check, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-300' },
  { key: 'absent', label: 'Absent', icon: X, color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-300' },
  { key: 'late', label: 'Retard', icon: Clock, color: 'text-orange-500', bg: 'bg-orange-100', border: 'border-orange-300' },
  { key: 'justified', label: 'Justifié', icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-300' },
]

export default function PresencePage() {
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const [selectedClass, setSelectedClass] = useState('CM2 A')
  const [attendance, setAttendance] = useState(() => {
    const init = {}
    students.forEach((s) => { init[s.id] = 'present' })
    return init
  })
  const [saved, setSaved] = useState(false)

  const setStatus = (id, status) => {
    setAttendance((prev) => ({ ...prev, [id]: status }))
    setSaved(false)
  }

  const handleSave = () => setSaved(true)

  const classStudents = students.filter((s) => s.class === selectedClass)
  const counts = {
    present: Object.values(attendance).filter((v) => v === 'present').length,
    absent: Object.values(attendance).filter((v) => v === 'absent').length,
    late: Object.values(attendance).filter((v) => v === 'late').length,
    justified: Object.values(attendance).filter((v) => v === 'justified').length,
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarCheck size={22} className="text-green-600" />
            Présence des Élèves
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="input text-sm w-32"
          >
            {['CP A', 'CP B', 'CE1 A', 'CE2 A', 'CM1 A', 'CM2 A'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={handleSave}
            className={cn('btn-primary text-sm', saved && 'bg-green-600 hover:bg-green-700')}
          >
            {saved ? <><Check size={15} /> Enregistré</> : 'Enregistrer l\'appel'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {statusOptions.map((s) => (
          <div key={s.key} className={`card p-4 border-l-4 ${s.border.replace('border-', 'border-l-')}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">{s.label}</span>
              <s.icon size={14} className={s.color} />
            </div>
            <div className={`text-2xl font-bold ${s.color}`}>{counts[s.key]}</div>
            <div className="text-xs text-gray-400">{Math.round((counts[s.key] / students.length) * 100)}%</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="font-medium text-gray-700">Marquer rapidement :</span>
        {statusOptions.map((s) => (
          <div key={s.key} className={`flex items-center gap-1 px-2 py-1 rounded-lg ${s.bg}`}>
            <s.icon size={11} className={s.color} />
            <span className={s.color + ' font-medium'}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Attendance list */}
      <div className="card overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Classe {selectedClass} — {classStudents.length} élèves</span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const all = {}
                students.forEach((s) => { all[s.id] = 'present' })
                setAttendance(all)
                setSaved(false)
              }}
              className="text-xs text-green-600 border border-green-300 px-3 py-1 rounded hover:bg-green-50"
            >
              Tous présents
            </button>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {classStudents.map((student, idx) => {
            const current = attendance[student.id] || 'present'
            const config = statusOptions.find((s) => s.key === current)
            return (
              <div key={student.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/50">
                <span className="text-xs text-gray-400 w-5 text-right">{idx + 1}</span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${student.gender === 'F' ? 'bg-pink-400' : 'bg-blue-400'}`}>
                  {student.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">{student.name}</div>
                  <div className="text-xs text-gray-400">{student.matricule}</div>
                </div>

                {/* Status toggle buttons */}
                <div className="flex items-center gap-1.5">
                  {statusOptions.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setStatus(student.id, s.key)}
                      title={s.label}
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center transition-all border',
                        current === s.key
                          ? `${s.bg} ${s.border} ${s.color}`
                          : 'bg-gray-50 border-gray-200 text-gray-300 hover:bg-gray-100'
                      )}
                    >
                      <s.icon size={14} />
                    </button>
                  ))}
                </div>

                {/* Current status badge */}
                <span className={cn('badge text-xs min-w-[70px] text-center justify-center', config?.bg, config?.color)}>
                  {config?.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Weekly history */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Historique de la semaine</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 pb-3 pr-6">Élève</th>
                {['Lun 20', 'Mar 21', 'Mer 22', 'Jeu 23', "Ven 24"].map((d) => (
                  <th key={d} className="text-center text-xs font-semibold text-gray-500 pb-3 px-3">{d}</th>
                ))}
                <th className="text-center text-xs font-semibold text-gray-500 pb-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {classStudents.map((student) => {
                const weekData = ['present', 'present', 'absent', 'present', 'late']
                const presentCount = weekData.filter((d) => d === 'present').length
                return (
                  <tr key={student.id}>
                    <td className="py-2.5 pr-6 text-sm text-gray-800">{student.name}</td>
                    {weekData.map((day, i) => {
                      const config = statusOptions.find((s) => s.key === day)
                      return (
                        <td key={i} className="py-2.5 px-3 text-center">
                          <div className={`w-6 h-6 rounded-md mx-auto flex items-center justify-center ${config?.bg}`}>
                            <config.icon size={11} className={config.color} />
                          </div>
                        </td>
                      )
                    })}
                    <td className="py-2.5 text-center">
                      <span className={`text-xs font-bold ${presentCount >= 4 ? 'text-green-600' : 'text-orange-500'}`}>
                        {presentCount}/5
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
