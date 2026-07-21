import { useState, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { QrCode, Download, Printer, Loader2, Users, GraduationCap, Search } from 'lucide-react'
import { entryAttendanceApi } from '../../lib/api'
import { useCachedFetch } from '../../hooks/useCachedFetch'
import { roleLabel } from '../../lib/roleLabels'
import { useAuth } from '../../context/AuthContext'

/**
 * Page principal : QR de présence individuels de tout le personnel et des élèves.
 * Téléchargement PNG individuel + impression en lot (grille de cartes).
 */
export default function PresenceQrPage() {
  const { school } = useAuth()
  const [tab, setTab] = useState('students')
  const [classFilter, setClassFilter] = useState('')
  const [search, setSearch] = useState('')
  const gridRef = useRef(null)

  const listQ = useCachedFetch('/entry-attendance/qr-list', async () => {
    const res = await entryAttendanceApi.qrList()
    return res.data || { staff: [], students: [] }
  }, [])

  const data = listQ.data || { staff: [], students: [] }
  const classNames = [...new Set(data.students.map((s) => s.className).filter(Boolean))].sort()

  const list = (tab === 'staff' ? data.staff : data.students)
    .filter((p) => !classFilter || p.className === classFilter)
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.matricule || '').toLowerCase().includes(search.toLowerCase()))

  // Télécharge le PNG d'une carte QR (canvas → PNG)
  const downloadOne = (qrId, name) => {
    const canvas = document.getElementById(`qr-${qrId}`)?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `qr-presence-${name.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  // Impression en lot : fenêtre print avec la grille de cartes (QR en dataURL)
  const printAll = () => {
    const cards = list.map((p) => {
      const canvas = document.getElementById(`qr-${p.qrId}`)?.querySelector('canvas')
      const img = canvas ? canvas.toDataURL('image/png') : ''
      return `<div class="c"><img src="${img}"/><div class="n">${p.name}</div><div class="m">${p.matricule || ''}${p.className ? ` · ${p.className}` : ''}${p.role ? ` · ${p.role}` : ''}</div></div>`
    }).join('')
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>QR de présence — ${school?.name || ''}</title><style>
      body{font-family:Arial,sans-serif;margin:16px}
      h1{font-size:16px;text-align:center;margin-bottom:12px}
      .g{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
      .c{border:1px dashed #999;border-radius:8px;padding:8px;text-align:center;page-break-inside:avoid}
      .c img{width:110px;height:110px}
      .n{font-size:11px;font-weight:bold;margin-top:4px}
      .m{font-size:9px;color:#666}
    </style></head><body><h1>QR de présence — ${school?.name || ''}</h1><div class="g">${cards}</div></body></html>`)
    w.document.close()
    setTimeout(() => { w.print() }, 400)
  }

  if (listQ.loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><QrCode size={20} className="text-indigo-600" /> QR de présence</h1>
          <p className="text-sm text-gray-500">QR individuels du personnel et des élèves — scannés par le portier à l'entrée/sortie</p>
        </div>
        <button onClick={printAll} disabled={list.length === 0} className="btn-primary text-sm self-start"><Printer size={15} /> Imprimer la sélection ({list.length})</button>
      </div>

      {/* Onglets + filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button onClick={() => { setTab('students'); setClassFilter('') }} className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${tab === 'students' ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>
            <GraduationCap size={13} /> Élèves ({data.students.length})
          </button>
          <button onClick={() => { setTab('staff'); setClassFilter('') }} className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${tab === 'staff' ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>
            <Users size={13} /> Personnel ({data.staff.length})
          </button>
        </div>
        {tab === 'students' && classNames.length > 0 && (
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="input text-xs w-auto">
            <option value="">Toutes les classes</option>
            {classNames.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher (nom, matricule)…" className="input text-xs pl-8 w-full" />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center">
          <QrCode size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Aucun résultat.</p>
        </div>
      ) : (
        <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {list.map((p) => (
            <div key={p.qrId} className="card p-3 text-center">
              <div id={`qr-${p.qrId}`} className="flex justify-center">
                <QRCodeCanvas value={p.qrId} size={120} level="M" includeMargin />
              </div>
              <p className="text-xs font-bold text-gray-900 mt-1 leading-tight">{p.name}</p>
              <p className="text-[10px] text-gray-400">
                {p.matricule || ''}
                {p.className ? ` · ${p.className}` : ''}
                {p.role ? ` · ${roleLabel(p.role, school)}` : ''}
              </p>
              <button onClick={() => downloadOne(p.qrId, p.name)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">
                <Download size={12} /> Télécharger
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
