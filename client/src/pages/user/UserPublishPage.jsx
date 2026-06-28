const TYPES = [
  { key: 'photo', label: 'Photo', Icon: Image, accept: 'image/*' },
  { key: 'video', label: 'Vidéo', Icon: Video, accept: 'video/*' },
  { key: 'audio', label: 'Audio', Icon: Music, accept: 'audio/*' },
]

export default function UserPublishPage() {
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [type, setType] = useState('photo')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const accept = TYPES.find((t) => t.key === type)?.accept

  const pickFile = (f) => {
    if (!f) return
    setFile(f)
    setError('')
    if (type === 'photo' || type === 'video') setPreview(URL.createObjectURL(f))
    else setPreview('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!file) return setError('Veuillez sélectionner un fichier.')
    if (!title.trim()) return setError('Veuillez ajouter un titre.')
    setLoading(true)
    try {
      await mediaApi.create({ title: title.trim(), description: description.trim(), type, files: [file], isPublic: true })
      setDone(true)
      setTimeout(() => navigate('/u'), 900)
    } catch (err) {
      setError(err.message || "Échec de la publication.")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="text-center py-20">
        <CheckCircle2 size={48} className="mx-auto text-green-500 mb-3" />
        <p className="font-semibold text-gray-900">Publication réussie !</p>
        <p className="text-sm text-gray-500">Redirection vers le fil social...</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Publier dans la galerie</h1>

      <div className="grid grid-cols-3 gap-2 mb-5">
        {TYPES.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => { setType(key); setFile(null); setPreview('') }}
            className={`flex flex-col items-center gap-1.5 py-4 rounded-xl border text-sm font-medium transition-colors ${
              type === key ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Icon size={24} /> {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
        >
          <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          {!file ? (
            <div className="text-gray-400">
              <UploadCloud size={36} className="mx-auto mb-2" />
              <p className="text-sm">Cliquez pour choisir un fichier {type}</p>
            </div>
          ) : (
            <div className="relative">
              <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); setPreview('') }} className="absolute -top-2 -right-2 bg-white rounded-full shadow p-1 text-gray-500"><X size={16} /></button>
              {type === 'photo' && preview && <img src={preview} alt="" className="max-h-60 mx-auto rounded-lg" />}
              {type === 'video' && preview && <video src={preview} controls className="max-h-60 mx-auto rounded-lg" />}
              {type === 'audio' && <p className="text-sm text-gray-700 flex items-center justify-center gap-2"><Music size={18} /> {file.name}</p>}
              {type !== 'audio' && <p className="text-xs text-gray-400 mt-2">{file.name}</p>}
            </div>
          )}
        </div>

        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" className="input w-full" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optionnel)" rows={3} className="input w-full resize-none" />

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Publication...' : 'Publier'}
        </button>
      </form>
    </div>
  )
}