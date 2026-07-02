import { useState, useEffect } from 'react'
import { Bell, MessageCircle, ThumbsUp, Loader2 } from 'lucide-react'
import { platformApi } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

function timeAgo(date) {
  if (!date) return ''
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "À l'instant"
  if (mins < 60) return `Il y a ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Il y a ${hrs} h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `Il y a ${days} j`
  return new Date(date).toLocaleDateString('fr-FR')
}

// Notifications de l'utilisateur — dérivées de l'activité reçue sur SES propres
// publications du fil social (commentaires et j'aime).
export default function UserNotificationsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const r = await platformApi.getFeed(1)
        const feed = r.data || []
        const myId = String(user?.id || user?._id || '')
        const notifs = []
        for (const p of feed) {
          const authorId = String(p.author?._id || p.author || '')
          if (!myId || authorId !== myId) continue

          for (const c of (p.comments || [])) {
            notifs.push({
              id: `${p._id}-c-${c._id || c.createdAt}`,
              type: 'comment',
              who: c.author || c.authorId?.name || 'Quelqu’un',
              text: 'a commenté votre publication',
              detail: c.content,
              post: p.title || p.content || 'votre publication',
              date: c.createdAt || p.createdAt,
            })
          }
          if ((p.likes?.length || 0) > 0) {
            notifs.push({
              id: `${p._id}-l`,
              type: 'like',
              who: `${p.likes.length} personne${p.likes.length > 1 ? 's' : ''}`,
              text: `ont aimé votre publication`,
              post: p.title || p.content || 'votre publication',
              date: p.createdAt,
            })
          }
        }
        notifs.sort((a, b) => new Date(b.date) - new Date(a.date))
        if (alive) setItems(notifs)
      } catch {
        if (alive) setItems([])
      }
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [user])

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <span className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
          <Bell size={18} />
        </span>
        <h1 className="text-lg font-bold text-gray-900">Notifications</h1>
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 size={22} className="animate-spin mx-auto text-blue-600" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bell size={40} className="mx-auto mb-3 opacity-40" />
          <p>Aucune notification pour le moment.</p>
          <p className="text-xs mt-1">Les j’aime et commentaires sur vos publications apparaîtront ici.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {items.map((n) => (
            <div key={n.id} className="flex items-start gap-3 p-4">
              <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                n.type === 'comment' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'
              }`}>
                {n.type === 'comment' ? <MessageCircle size={16} /> : <ThumbsUp size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-800">
                  <span className="font-semibold">{n.who}</span> {n.text}
                </p>
                {n.detail && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">« {n.detail} »</p>}
                <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.date)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
