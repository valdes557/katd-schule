import { useState } from 'react'
import { MessageCircle, Phone, Mail, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { platformApi } from '../../lib/api'

export default function ContactsTab({ platformData }) {
  const defaultContacts = [
    { type: 'whatsapp', label: 'WhatsApp', value: '+237 6 00 00 00 00' },
    { type: 'phone', label: 'Téléphone', value: '+237 6 00 00 00 00' },
    { type: 'email', label: 'Email', value: 'contact@katdschool.com' },
  ]

  const contacts = platformData?.contacts?.length > 0 ? platformData.contacts : defaultContacts

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  })
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null) // { type: 'success' | 'error', message: '' }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus(null)
    try {
      const res = await platformApi.sendContactMessage(formData)
      setStatus({
        type: 'success',
        message: res.message || 'Votre message a été envoyé avec succès ! Nous vous répondrons dans les plus brefs délais.',
      })
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' })
    } catch (err) {
      setStatus({
        type: 'error',
        message: err.message || "Une erreur est survenue lors de l'envoi de votre message. Veuillez réessayer.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Nous contacter</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {contacts.map((c, i) => (
          <a
            key={i}
            href={
              c.type === 'whatsapp'
                ? `https://wa.me/${c.value.replace(/\D/g, '')}`
                : c.type === 'phone'
                ? `tel:${c.value}`
                : `mailto:${c.value}`
            }
            target={c.type === 'whatsapp' ? '_blank' : undefined}
            rel="noreferrer"
            className="bg-white border border-gray-100 rounded-xl p-4 hover:border-blue-300 hover:shadow-card transition-all flex items-center gap-3"
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                c.type === 'whatsapp'
                  ? 'bg-green-100 text-green-600'
                  : c.type === 'phone'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-purple-100 text-purple-600'
              }`}
            >
              {c.type === 'whatsapp' ? (
                <MessageCircle size={18} />
              ) : c.type === 'phone' ? (
                <Phone size={18} />
              ) : (
                <Mail size={18} />
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">{c.label}</div>
              <div className="text-xs text-gray-500">{c.value}</div>
            </div>
          </a>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
          <Send size={15} className="text-blue-600" /> Envoyez-nous un message
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Une question ou un projet ? Écrivez-nous directement via ce formulaire, notre équipe vous répondra sans délai.
        </p>

        {status && (
          <div
            className={`p-3.5 rounded-lg mb-4 text-xs flex items-start gap-2.5 ${
              status.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {status.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
            )}
            <span>{status.message}</span>
          </div>
        )}

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Votre nom *</label>
              <input
                required
                className="input text-sm w-full"
                placeholder="Ex. Jean Dupont"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Votre email *</label>
              <input
                required
                type="email"
                className="input text-sm w-full"
                placeholder="exemple@domaine.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone (optionnel)</label>
              <input
                type="tel"
                className="input text-sm w-full"
                placeholder="+237 6..."
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Objet du message</label>
              <input
                className="input text-sm w-full"
                placeholder="Ex. Demande d'information école"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Votre message *</label>
            <textarea
              required
              rows={4}
              className="input text-sm resize-none w-full"
              placeholder="Expliquez-nous comment nous pouvons vous aider..."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary text-sm inline-flex items-center gap-2"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {loading ? 'Envoi en cours...' : 'Envoyer le message'}
          </button>
        </form>
      </div>
    </div>
  )
}

