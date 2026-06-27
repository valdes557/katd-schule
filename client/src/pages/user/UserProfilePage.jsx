const ASSET = import.meta.env.VITE_API_URL || ''
const asset = (u) => (!u ? '' : u.startsWith('http') ? u : ASSET + u)

export default function UserProfilePage() {
  const { user, setUser } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [avatar, setAvatar] = useState(user?.avatar || '')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const persist = (u) => {
    setUser(u)
    try { localStorage.setItem('katd_user', JSON.stringify(u)) } catch { /* ignore */ }
  }

  const onAvatar = async (file) => {
    if (!file) return
    setError('')
    try {
      const r = await authApi.uploadAvatar(file)
      const url = r.avatar || r.url || (r.user && r.user.avatar) || ''
      if (url) { setAvatar(url); persist({ ...user, avatar: url }) }
    } catch (err) { setError(err.message) }
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const r = await authApi.updateProfile({ name: name.trim(), bio: bio.trim() })
      const u = r.user || { ...user, name: name.trim(), bio: bio.trim() }
      persist(u)
      setDone(true); setTimeout(() => setDone(false), 2000)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-5">Mon profil</h1>

      <div className="flex flex-col items-center mb-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-3xl font-bold overflow-hidden">
            {avatar ? <img src={asset(avatar)} alt="" className="w-full h-full object-cover" /> : (name || '?').charAt(0).toUpperCase()}
          </div>
          <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700">
            <Camera size={16} />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onAvatar(e.target.files?.[0])} />
          </label>
        </div>
        <p className="text-sm text-gray-500 mt-2">{user?.email}</p>
      </div>

      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Parlez de vous..." className="input w-full resize-none" />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        {done && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 flex items-center gap-2"><CheckCircle2 size={16} /> Profil mis à jour</p>}

        <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
          <Save size={18} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </form>

    </div>
  )
}