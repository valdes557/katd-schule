import { MessageCircle, Phone, Mail, Send } from 'lucide-react'

export default function ContactsTab({ platformData }) {
  const defaultContacts = [
    { type: 'whatsapp', label: 'WhatsApp', value: '+237 6 00 00 00 00' },
    { type: 'phone', label: 'Téléphone', value: '+237 6 00 00 00 00' },
    { type: 'email', label: 'Email', value: 'contact@katd-schule.com' },
  ]

  const contacts = platformData?.contacts?.length > 0 ? platformData.contacts : defaultContacts

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

      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Send size={14} className="text-blue-600" /> Envoyez-nous un message
        </h3>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            alert('Message envoyé !')
          }}
        >
          <input required className="input text-sm w-full" placeholder="Votre nom" />
          <input required type="email" className="input text-sm w-full" placeholder="Votre email" />
          <textarea
            required
            rows={4}
            className="input text-sm resize-none w-full"
            placeholder="Votre message..."
          />
          <button type="submit" className="btn-primary text-sm">
            <Send size={14} /> Envoyer
          </button>
        </form>
      </div>
    </div>
  )
}
