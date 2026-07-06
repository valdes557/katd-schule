import { MessageCircle } from 'lucide-react'

// Bouton WhatsApp flottant. Le lien est fourni par la configuration admin
// (un lien par type de dashboard + un pour la page d'accueil). Masqué si vide.
// position : 'bottom-right' (dashboards) | 'bottom-left' (/u) | 'bottom-center' (accueil)
const POSITIONS = {
  'bottom-right': 'bottom-5 right-5',
  'bottom-left': 'bottom-5 left-5',
  'bottom-center': 'bottom-5 left-1/2 -translate-x-1/2',
}

export default function WhatsAppFab({ link, position = 'bottom-right' }) {
  if (!link || !String(link).trim()) return null
  // Accepte un numéro brut, un lien wa.me ou une URL complète.
  const raw = String(link).trim()
  const href = /^https?:\/\//i.test(raw)
    ? raw
    : `https://wa.me/${raw.replace(/[^0-9]/g, '')}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title="Nous contacter sur WhatsApp"
      className={`fixed ${POSITIONS[position] || POSITIONS['bottom-right']} z-[60] w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-110`}
    >
      <MessageCircle size={26} />
    </a>
  )
}
