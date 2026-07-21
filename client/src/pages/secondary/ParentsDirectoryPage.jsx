import { useState } from 'react'
import { Users, Loader2, Search, Phone, Mail, MessageSquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { parentsApi } from '../../lib/api'
import { useCachedFetch } from '../../hooks/useCachedFetch'

/** Annuaire des parents — Surveillant Général (contacts + WhatsApp + Messenger). */
export default function ParentsDirectoryPage() {
  const [search, setSearch] = useState('')
  const listQ = useCachedFetch('/parents/directory', async () => (await parentsApi.directory()).data || [], [])

  const parents = (listQ.data || []).filter((p) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.children || []).some((c) => c.toLowerCase().includes(search.toLowerCase()))
  )

  if (listQ.loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Users size={20} className="text-indigo-600" /> Contacts des parents</h1>
        <p className="text-sm text-gray-500">Joignez les parents d'élèves par téléphone, WhatsApp ou Messenger</p>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher (parent ou élève)…" className="input text-sm pl-8 w-full" />
      </div>

      {parents.length === 0 ? (
        <div className="card p-10 text-center">
          <Users size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Aucun parent trouvé.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3">Enfant(s)</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3 text-right">Contacter</th>
              </tr>
            </thead>
            <tbody>
              {parents.map((p) => {
                const phoneDigits = (p.phone || '').replace(/\D/g, '')
                return (
                  <tr key={p._id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{p.name}</span>
                      {p.email && <span className="block text-[11px] text-gray-400">{p.email}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{(p.children || []).join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{p.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {phoneDigits && (
                          <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" title="WhatsApp" className="p-1.5 rounded-lg hover:bg-green-50 text-green-600"><Phone size={15} /></a>
                        )}
                        {p.email && (
                          <a href={`mailto:${p.email}`} title="Email" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><Mail size={15} /></a>
                        )}
                        <Link to="/dashboard/messagerie" title="Messenger" className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600"><MessageSquare size={15} /></Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
