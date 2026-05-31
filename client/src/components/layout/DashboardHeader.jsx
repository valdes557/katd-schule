import { useState, useRef } from 'react'
import { Menu, Bell, ChevronDown, BookOpen, GraduationCap, Baby, Calendar } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getInitials } from '../../lib/utils'
import { authApi } from '../../lib/api'

const CYCLES = [
  { label: 'Cycle Maternelle', icon: Baby, color: 'text-orange-500' },
  { label: 'Cycle Primaire', icon: BookOpen, color: 'text-blue-600' },
  { label: 'Cycle Secondaire', icon: GraduationCap, color: 'text-green-600' },
]

export default function DashboardHeader({ onMenuClick }) {
  const { user, setUser, school, cycle, changeCycle } = useAuth()
  const [cycleOpen, setCycleOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [notifications] = useState(3)
  const [profileOpen, setProfileOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pForm, setPForm] = useState({ name: '', phone: '' })
  const fileRef = useRef()

  const isDirecteur = user?.role === 'directeur'
  const subscribedCycle = isDirecteur && school?.subscription?.cycle ? school.subscription.cycle : null
  const effectiveCycle = subscribedCycle || cycle
  const currentCycle = CYCLES.find((c) => c.label.includes(effectiveCycle)) || CYCLES[1]

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-[260px] h-14 bg-white border-b border-gray-100 flex items-center justify-between px-3 sm:px-5 z-30">
      {/* Left: hamburger (mobile only) */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        aria-label="Ouvrir le menu"
      >
        <Menu size={20} />
      </button>
      <div className="hidden lg:block" />

      {/* Right: cycle + notif + user */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Cycle Selector */}
        <div className="relative">
          {isDirecteur && subscribedCycle ? (
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 sm:px-3 py-1.5 text-sm font-medium text-gray-700 bg-white">
              <currentCycle.icon size={15} className={currentCycle.color} />
              <span className="hidden md:inline">{currentCycle.label}</span>
            </div>
          ) : (
            <>
              <button
                onClick={() => { setCycleOpen(!cycleOpen); setUserOpen(false) }}
                className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 sm:px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <currentCycle.icon size={15} className={currentCycle.color} />
                <span className="hidden md:inline">{currentCycle.label}</span>
                <ChevronDown size={14} className="text-gray-400" />
              </button>
              {cycleOpen && (
                <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-card-lg w-52 py-1 z-50">
                  {CYCLES.map((c) => (
                    <button
                      key={c.label}
                      onClick={() => { changeCycle(c.label.replace('Cycle ', '')); setCycleOpen(false) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <c.icon size={15} className={c.color} />
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Notifications */}
        <button className="relative p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <Bell size={19} />
          {notifications > 0 && (
            <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {notifications}
            </span>
          )}
        </button>

        {/* User */}
        <div className="relative">
          <button
            onClick={() => { setUserOpen(!userOpen); setCycleOpen(false) }}
            className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                {user ? getInitials(user.name || 'Directeur') : 'DR'}
              </div>
            )}
            <div className="text-left hidden sm:block">
              <div className="text-sm font-semibold text-gray-800 leading-tight">
                {user?.name || 'Directeur'}
              </div>
              <div className="text-xs text-gray-400 leading-tight truncate max-w-[130px]">
                {school?.name || "École Les Petits Génies"}
              </div>
            </div>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          {userOpen && (
            <div className="absolute right-0 top-11 bg-white border border-gray-200 rounded-xl shadow-card-lg w-48 py-1 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <div className="text-sm font-semibold text-gray-800">{user?.name || 'Directeur'}</div>
                <div className="text-xs text-gray-400">{user?.role || 'Admin école'}</div>
              </div>
              <button onClick={() => { setProfileOpen(true); setUserOpen(false); setPForm({ name: user?.name || '', phone: user?.phone || '' }) }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Mon profil</button>
              <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Paramètres</button>
            </div>
          )}
        </div>
      </div>
    </header>
    {profileOpen && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-base font-bold text-gray-900">Mon profil</div>
            <button onClick={() => setProfileOpen(false)} className="text-gray-400">✕</button>
          </div>
          <div className="flex items-center gap-3 mb-3">
            {user?.avatar ? (
              <img src={user.avatar} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">{getInitials(user?.name || 'U')}</div>
            )}
            <div>
              <button onClick={() => fileRef.current?.click()} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50">Changer la photo</button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return; setSaving(true)
                try { const r = await authApi.uploadAvatar(f); if (r?.user) { setUser(r.user); try { localStorage.setItem('katd_user', JSON.stringify(r.user)) } catch (_) {} } }
                catch (err) { alert(err.message) }
                setSaving(false)
              }} />
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-600">Nom complet</label>
              <input value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} className="w-full mt-0.5 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Téléphone</label>
              <input value={pForm.phone} onChange={(e) => setPForm({ ...pForm, phone: e.target.value })} className="w-full mt-0.5 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setProfileOpen(false)} className="flex-1 justify-center border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50">Fermer</button>
            <button disabled={saving} onClick={async () => {
              setSaving(true)
              try { const r = await authApi.updateProfile({ name: pForm.name, phone: pForm.phone }); if (r?.user) { setUser(r.user); try { localStorage.setItem('katd_user', JSON.stringify(r.user)) } catch (_) {} } }
              catch (err) { alert(err.message) }
              setSaving(false); setProfileOpen(false)
            }} className="btn-primary flex-1 justify-center">Enregistrer</button>
          </div>
        </div>
      </div>
    )}
  )
}
