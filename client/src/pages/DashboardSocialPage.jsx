import { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, Film, Music, Plus, Loader2 } from 'lucide-react'
import { platformApi } from '../lib/api'
import SocialTab from '../components/landing/SocialTab'
import { useAuth } from '../context/AuthContext'

const MEDIA_TYPES = [
  { id: 'photo', label: 'Photo', icon: '🖼️' },
  { id: 'video', label: 'Vidéo', icon: '🎬' },
  { id: 'audio', label: 'Audio', icon: '🎵' },
]

const CATEGORIES = ['Éducation', 'Sport', 'Culture', 'Sciences', 'Technologie']

export default function DashboardSocialPage() {
  const { user } = useAuth()
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)

  const [mediaType, setMediaType] = useState('photo')
  const [form, setForm] = useState({ title: '', content: '', category: '', videoUrl: '', duration: '' })
  const [imageFiles, setImageFiles] = useState([])
  const [audioFile, setAudioFile] = useState(null)
  const [videoFile, setVideoFile] = useState(null)
  const [previews, setPreviews] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)

  const imageRef = useRef(null)
  const audioRef = useRef(null)
  const videoRef = useRef(null)

  useEffect(() => {
    platformApi.getFeed(1)
      .then((r) => setFeed(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleImages = (e) => {
    const files = Array.from(e.target.files || [])
    setImageFiles(files)
    setPreviews(files.map((f) => URL.createObjectURL(f)))
  }

  const resetForm = () => {
    setForm({ title: '', content: '', category: '', videoUrl: '', duration: '' })
    setImageFiles([])
    setAudioFile(null)
    setVideoFile(null)
    setPreviews([])
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.content.trim() || !form.title.trim()) return
    setSubmitting(true)
    setProgress(0)
    const fd = new FormData()
    fd.append('mediaType', mediaType)
    Object.entries(form).forEach(([k, v]) => {
      if (v) fd.append(k, v)
    })
    imageFiles.forEach((f) => fd.append('images', f))
    if (audioFile) fd.append('audio', audioFile)
    if (videoFile) fd.append('video', videoFile)
    try {
      const r = await platformApi.createPostWithProgress(fd, setProgress)
      if (r.success && r.data) {
        setFeed((prev) => [r.data, ...(prev || [])])
        resetForm()
      } else {
        alert(r.message || 'Erreur lors de la publication')
      }
    } catch (err) {
      alert(err.message)
    }
    setSubmitting(false)
    setProgress(0)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mon Social</h1>
          <p className="text-sm text-gray-500">Publiez des photos, vidéos ou audios qui apparaîtront dans le fil social public.</p>
        </div>
      </div>

      {/* Create post form */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Plus size={14} className="text-blue-600" /> Nouvelle publication
        </h3>

        <div className="flex flex-wrap gap-2">
          {MEDIA_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setMediaType(t.id); resetForm() }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                mediaType === t.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleCreate} className="space-y-3">
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="input text-sm w-full"
            placeholder="Titre *"
          />
          <textarea
            required
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={3}
            className="input text-sm resize-none w-full"
            placeholder="Description *"
          />

          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input text-sm"
            >
              <option value="">Catégorie</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              className="input text-sm"
              placeholder="Durée ex: 3:45 (optionnel)"
            />
          </div>

          {mediaType === 'photo' && (
            <div>
              <button
                type="button"
                onClick={() => imageRef.current?.click()}
                className="btn-ghost text-sm border border-dashed border-gray-300 w-full justify-center py-3 hover:border-blue-400"
              >
                <ImageIcon size={15} className="text-blue-500" /> Sélectionner les photos (max 5)
              </button>
              <input
                ref={imageRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImages}
              />
              {previews.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {previews.map((p, i) => (
                    <img key={i} src={p} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                  ))}
                </div>
              )}
            </div>
          )}

          {mediaType === 'video' && (
            <div className="space-y-2">
              <input
                value={form.videoUrl}
                onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                className="input text-sm w-full"
                placeholder="URL YouTube / lien vidéo externe (optionnel)"
              />
              <div className="text-xs text-gray-400 text-center">— ou uploader un fichier vidéo —</div>
              <button
                type="button"
                onClick={() => videoRef.current?.click()}
                className="btn-ghost text-sm border border-dashed border-gray-300 w-full justify-center py-3 hover:border-blue-400"
              >
                <Film size={15} className="text-purple-500" /> {videoFile ? videoFile.name : 'Sélectionner une vidéo (MP4, MOV…)'}
              </button>
              <input
                ref={videoRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              />
            </div>
          )}

          {mediaType === 'audio' && (
            <div>
              <button
                type="button"
                onClick={() => audioRef.current?.click()}
                className="btn-ghost text-sm border border-dashed border-gray-300 w-full justify-center py-3 hover:border-blue-400"
              >
                <Music size={15} className="text-green-500" /> {audioFile ? audioFile.name : 'Sélectionner un fichier audio (MP3, WAV…)'}
              </button>
              <input
                ref={audioRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              />
              {audioFile && (
                <audio controls src={URL.createObjectURL(audioFile)} className="w-full mt-2 rounded-lg" />
              )}
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn-primary text-sm">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {submitting && progress > 0 && progress < 100 ? `Envoi… ${progress}%` : 'Publier'}
          </button>

          {/* Upload progress bar — shown while media is being sent to the server */}
          {submitting && progress > 0 && (
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </form>
      </div>

      {/* Social feed preview */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        {loading ? (
          <div className="text-center py-10">
            <Loader2 size={22} className="animate-spin mx-auto text-blue-600" />
          </div>
        ) : (
          <SocialTab feed={feed} setFeed={setFeed} user={user} />
        )}
      </div>
    </div>
  )
}
