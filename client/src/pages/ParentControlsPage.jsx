import { useEffect, useState } from 'react'
import {
  Shield, Clock, Eye, Bell, Loader2, Save, User, AlertTriangle,
} from 'lucide-react'
import { parentApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'

export default function ParentControlsPage() {
  const [selectedChild, setSelectedChild] = useState(null)
  const [saving, setSaving] = useState(false)

  const dashQ = useCachedFetch(
    '/parent/dashboard',
    async () => (await parentApi.dashboard()).data || null,
    [],
  )

  const children = dashQ.data?.children || []

  // Auto-select first child once dashboard data arrives
  useEffect(() => {
    if (!selectedChild && children.length > 0) setSelectedChild(children[0]._id)
  }, [children, selectedChild])

  const controlsQ = useCachedFetch(
    selectedChild ? `/parent/controls/${selectedChild}` : null,
    async () => (await parentApi.getControls(selectedChild)).data || null,
    [selectedChild],
  )

  const controls = controlsQ.data
  const loading = dashQ.loading || (selectedChild && controlsQ.loading)

  // Local editable copy of controls (kept in sync with fetched data via setData)
  const setControls = (updater) => {
    controlsQ.setData(updater)
  }

  const handleSave = async () => {
    if (!controls || !selectedChild) return
    setSaving(true)
    try {
      const r = await parentApi.updateControls(selectedChild, controls)
      cache.invalidate(`/parent/controls/${selectedChild}`)
      controlsQ.setData(r.data)
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const updateScreenTime = (key, val) => setControls((prev) => ({ ...prev, screenTime: { ...prev.screenTime, [key]: val } }))
  const updateAlerts = (key, val) => setControls((prev) => ({ ...prev, alerts: { ...prev.alerts, [key]: val } }))

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Shield size={22} className="text-orange-600" /> Contrôle Parental</h1>
        <p className="text-sm text-gray-500">Gérez le temps d'écran et les alertes de vos enfants</p>
      </div>

      {/* Child selector */}
      {children.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {children.map((c) => (
            <button key={c._id} onClick={() => setSelectedChild(c._id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${selectedChild === c._id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <User size={13} /> {c.fullName}
            </button>
          ))}
        </div>
      )}

      {loading ? <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div> : !controls ? (
        <div className="text-center py-16 text-gray-400"><Shield size={36} className="mx-auto mb-3 opacity-30" /><p>Sélectionnez un enfant</p></div>
      ) : (
        <div className="space-y-5">
          {/* Screen Time */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Clock size={16} className="text-blue-600" /> Temps d'écran</h3>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={controls.screenTime?.enabled || false} onChange={(e) => updateScreenTime('enabled', e.target.checked)} className="rounded border-gray-300 text-blue-600" />
                Activé
              </label>
            </div>
            {controls.screenTime?.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Max heures/jour</label>
                  <input type="number" min="1" max="24" value={controls.screenTime?.maxHoursPerDay || 3} onChange={(e) => updateScreenTime('maxHoursPerDay', Number(e.target.value))} className="input text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Accès autorisé de</label>
                  <input type="time" value={controls.screenTime?.allowedFrom || '08:00'} onChange={(e) => updateScreenTime('allowedFrom', e.target.value)} className="input text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Jusqu'à</label>
                  <input type="time" value={controls.screenTime?.allowedTo || '20:00'} onChange={(e) => updateScreenTime('allowedTo', e.target.value)} className="input text-sm" />
                </div>
              </div>
            )}
          </div>

          {/* Content Access */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4"><Eye size={16} className="text-purple-600" /> Contenu accessible</h3>
            <p className="text-xs text-gray-500 mb-3">Bloquez certains modules pour cet enfant</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {['Messagerie', 'Ressources', 'Activités', 'Documents', 'Annonces', 'Média'].map((mod) => {
                const isBlocked = (controls.blockedModules || []).includes(mod)
                return (
                  <button key={mod} onClick={() => {
                    const mods = controls.blockedModules || []
                    setControls((prev) => ({ ...prev, blockedModules: isBlocked ? mods.filter((m) => m !== mod) : [...mods, mod] }))
                  }} className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${isBlocked ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                    {isBlocked ? '🚫' : '✅'} {mod}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Alerts */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4"><Bell size={16} className="text-amber-600" /> Alertes</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Inactivité</p>
                  <p className="text-xs text-gray-400">Notification si l'enfant ne se connecte pas depuis X jours</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" max="30" value={controls.alerts?.inactivityDays || 3} onChange={(e) => updateAlerts('inactivityDays', Number(e.target.value))} className="input text-sm w-16" />
                  <span className="text-xs text-gray-500">jours</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Chute de moyenne</p>
                  <p className="text-xs text-gray-400">Alerte si la moyenne baisse de X points</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" max="10" value={controls.alerts?.gradeDropThreshold || 2} onChange={(e) => updateAlerts('gradeDropThreshold', Number(e.target.value))} className="input text-sm w-16" />
                  <span className="text-xs text-gray-500">pts</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Notification par email</p>
                  <p className="text-xs text-gray-400">Recevoir les alertes par email</p>
                </div>
                <label className="flex items-center">
                  <input type="checkbox" checked={controls.alerts?.notifyByEmail !== false} onChange={(e) => updateAlerts('notifyByEmail', e.target.checked)} className="rounded border-gray-300 text-blue-600" />
                </label>
              </div>
            </div>
          </div>

          {/* Activity indicator */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3"><AlertTriangle size={16} className="text-green-600" /> Activité</h3>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${controls.lastActivity && (new Date() - new Date(controls.lastActivity)) < 15 * 60 * 1000 ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
              <p className="text-sm text-gray-700">
                {controls.lastActivity && (new Date() - new Date(controls.lastActivity)) < 15 * 60 * 1000
                  ? 'En ligne maintenant'
                  : controls.lastActivity
                    ? `Dernière activité: ${new Date(controls.lastActivity).toLocaleString('fr-FR')}`
                    : 'Aucune activité enregistrée'
                }
              </p>
            </div>
            {controls.todayScreenMinutes > 0 && (
              <p className="text-xs text-gray-500 mt-2">Temps d'écran aujourd'hui: <strong>{Math.round(controls.todayScreenMinutes / 60)}h{String(controls.todayScreenMinutes % 60).padStart(2, '0')}</strong></p>
            )}
          </div>

          {/* Save button */}
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-2.5 px-6">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer les paramètres
          </button>
        </div>
      )}
    </div>
  )
}
