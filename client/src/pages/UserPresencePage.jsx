import { useEffect, useState } from 'react'
import { presenceApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { Loader2, Activity, Trash2, School as SchoolIcon, RefreshCw, Circle } from 'lucide-react'

const ROLE_LABEL = {
  directeur: 'Directeur',
  enseignant: 'Enseignant',
  parent: 'Parent',
  eleve: 'Élève',
  super_admin: 'Admin',
}
const ROLE_CLS = {
  directeur: 'bg-blue-100 text-blue-700',
  enseignant: 'bg-purple-100 text-purple-700',
  parent: 'bg-teal-100 text-teal-700',
  eleve: 'bg-amber-100 text-amber-700',
  super_admin: 'bg-gray-200 text-gray-700',
}

function fmt(d) {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function Avatar({ photo, name, online }) {
  return (
    <div className="relative flex-shrink-0">
      {photo ? (
        <img src={photo} alt="" className="w-9 h-9 rounded-full object-cover" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
          {(name || '?')[0]?.toUpperCase()}
        </div>
      )}
      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white ${online ? 'bg-green-500' : 'bg-gray-300'}`} />
    </div>
  )
}

function UserRow({ u, canDelete, onReset }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
      <Avatar photo={u.avatar} name={u.name} online={u.online} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ROLE_CLS[u.role] || 'bg-gray-100 text-gray-600'}`}>{ROLE_LABEL[u.role] || u.role}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500 mt-0.5">
          {u.online ? (
            <span className="text-green-600 font-semibold flex items-center gap-1"><Circle size={8} className="fill-green-500 text-green-500" /> En ligne</span>
          ) : (
            <span className="text-gray-400 flex items-center gap-1"><Circle size={8} className="fill-gray-300 text-gray-300" /> Hors ligne</span>
          )}
          <span>Connexion : <strong className="text-gray-600">{fmt(u.lastLogin)}</strong></span>
          <span>Déconnexion : <strong className="text-gray-600">{fmt(u.lastLogout)}</strong></span>
        </div>
      </div>
      {canDelete && (
        <button onClick={() => onReset(u)} title="Réinitialiser le suivi" className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 flex-shrink-0">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  )
}

export default function UserPresencePage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'super_admin'
  const [schoolFilter, setSchoolFilter] = useState('')

  const q = useCachedFetch('/presence', async () => {
    const r = await presenceApi.list()
    return r.data || { users: [], schools: [], canDelete: false }
  }, [])

  const refresh = () => { cache.invalidate('/presence'); q.refetch() }

  // Rafraîchissement automatique toutes les 30 s
  useEffect(() => {
    const id = setInterval(() => q.refetch(), 30000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const data = q.data || { users: [], schools: [], canDelete: false }
  const users = data.users || []
  const canDelete = data.canDelete
  const onlineCount = users.filter((u) => u.online).length

  const reset = async (u) => {
    if (!window.confirm(`Réinitialiser le suivi de connexion de ${u.name} ?`)) return
    try { await presenceApi.reset(u.id); refresh() } catch (e) { alert(e.message) }
  }

  // Regroupement par établissement pour le super admin
  const schoolName = Object.fromEntries((data.schools || []).map((s) => [String(s.id), s.name]))
  const groups = {}
  if (isAdmin) {
    for (const u of users) {
      const key = u.schoolId ? String(u.schoolId) : 'none'
      if (schoolFilter && key !== schoolFilter) continue
      ;(groups[key] = groups[key] || []).push(u)
    }
  }
  const groupKeys = Object.keys(groups).sort((a, b) => (schoolName[a] || 'zzz').localeCompare(schoolName[b] || 'zzz'))

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Activity size={22} className="text-indigo-600" /> Suivi des connexions</h1>
          <p className="text-sm text-gray-500">
            {isAdmin
              ? "Statut en ligne des utilisateurs de chaque établissement (parents inclus)."
              : "Voyez qui est en ligne dans votre établissement et leurs heures de connexion."}
          </p>
        </div>
        <button onClick={refresh} className="btn-ghost text-xs border border-gray-200 self-start"><RefreshCw size={13} /> Actualiser</button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center"><Circle size={18} className="fill-green-500 text-green-500" /></div>
          <div><p className="text-xs text-gray-500">En ligne</p><p className="text-lg font-bold text-gray-900">{onlineCount}</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Activity size={18} /></div>
          <div><p className="text-xs text-gray-500">Utilisateurs</p><p className="text-lg font-bold text-gray-900">{users.length}</p></div>
        </div>
        {isAdmin && (
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><SchoolIcon size={18} /></div>
            <div><p className="text-xs text-gray-500">Établissements</p><p className="text-lg font-bold text-gray-900">{(data.schools || []).length}</p></div>
          </div>
        )}
      </div>

      {q.loading ? (
        <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">Aucun utilisateur à suivre pour le moment.</p>
      ) : isAdmin ? (
        <>
          {(data.schools || []).length > 0 && (
            <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className="input text-sm">
              <option value="">Tous les établissements</option>
              {(data.schools || []).map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              <option value="none">Sans établissement</option>
            </select>
          )}
          <div className="space-y-4">
            {groupKeys.map((key) => {
              const list = groups[key]
              const online = list.filter((u) => u.online).length
              return (
                <div key={key} className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <SchoolIcon size={15} className="text-indigo-600" /> {key === 'none' ? 'Sans établissement' : (schoolName[key] || 'Établissement')}
                      <span className="text-gray-400 font-normal">({list.length})</span>
                    </h3>
                    <span className="text-xs text-green-600 font-semibold">{online} en ligne</span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    {list.map((u) => <UserRow key={u.id} u={u} canDelete={canDelete} onReset={reset} />)}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div className="card p-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {users.map((u) => <UserRow key={u.id} u={u} canDelete={false} onReset={reset} />)}
          </div>
        </div>
      )}
    </div>
  )
}
