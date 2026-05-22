import { useState } from 'react'
import { Star } from 'lucide-react'
import { platformApi } from '../../lib/api'

export default function ExperiencesTab({ experiences, setExperiences }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ authorName: '', content: '', rating: 5 })

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `Il y a ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `Il y a ${hrs} h`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `Il y a ${days} j`
    return new Date(date).toLocaleDateString('fr-FR')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await platformApi.submitExperience(form)
      setForm({ authorName: '', content: '', rating: 5 })
      setShowForm(false)
      alert('Témoignage soumis avec succès ! Il sera visible après validation.')
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900">Témoignages</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
          <Star size={14} /> Donner mon avis
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-100 rounded-xl p-5 space-y-3"
        >
          <h3 className="text-sm font-bold text-gray-900">Partagez votre expérience</h3>
          <input
            required
            value={form.authorName}
            onChange={(e) => setForm({ ...form, authorName: e.target.value })}
            className="input text-sm w-full"
            placeholder="Votre nom"
          />
          <textarea
            required
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={3}
            className="input text-sm resize-none w-full"
            placeholder="Votre témoignage..."
          />
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-2">Note :</span>
            {[1, 2, 3, 4, 5].map((s) => (
              <button type="button" key={s} onClick={() => setForm({ ...form, rating: s })}>
                <Star
                  size={18}
                  className={
                    s <= form.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'
                  }
                />
              </button>
            ))}
          </div>
          <button type="submit" className="btn-primary text-sm">
            Soumettre
          </button>
        </form>
      )}

      {experiences.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-12">
          Aucun témoignage pour le moment. Soyez le premier !
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {experiences.map((exp) => (
            <div key={exp._id} className="bg-white border border-gray-100 rounded-xl p-5">
              <div className="flex gap-0.5 mb-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={14}
                    className={
                      s <= exp.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'
                    }
                  />
                ))}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed italic">"{exp.content}"</p>
              <div className="mt-3 pt-3 border-t border-gray-50">
                <span className="text-xs font-semibold text-gray-900">{exp.authorName}</span>
                <span className="text-[10px] text-gray-400 ml-2">{timeAgo(exp.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
