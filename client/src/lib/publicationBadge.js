// Gestionnaire universel des badges de publications non lues (Actualités, recrutements, démos, etc.)
// Maintient la synchronisation en temps réel entre le menu mobile, la barre de navigation et les pages.

const READ_KEY = 'katd_read_publication_ids'
const BADGE_EVENT = 'katd_publication_badge_updated'

export function getReadPublicationIds() {
  try {
    const raw = localStorage.getItem(READ_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch (_) {
    return new Set()
  }
}

export function isPublicationRead(pubId) {
  if (!pubId) return true
  const readSet = getReadPublicationIds()
  return readSet.has(String(pubId))
}

export function markPublicationAsRead(pubId) {
  if (!pubId) return
  try {
    const readSet = getReadPublicationIds()
    readSet.add(String(pubId))
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(readSet)))
    // Notifie tous les composants écoutant le badge
    window.dispatchEvent(new CustomEvent(BADGE_EVENT, { detail: { markedId: pubId } }))
  } catch (_) {}
}

export function markAllPublicationsAsRead(pubIds = []) {
  try {
    const readSet = getReadPublicationIds()
    pubIds.forEach((id) => {
      if (id) readSet.add(String(id))
    })
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(readSet)))
    localStorage.setItem('home_news_seen', String(Date.now()))
    localStorage.setItem('u_news_seen', String(Date.now()))
    window.dispatchEvent(new CustomEvent(BADGE_EVENT, { detail: { all: true } }))
  } catch (_) {}
}

export function getUnreadCountFromFeed(feed = []) {
  if (!Array.isArray(feed) || feed.length === 0) return 0
  const readSet = getReadPublicationIds()
  return feed.filter((item) => item?._id && !readSet.has(String(item._id))).length
}

export function subscribeToBadgeUpdates(callback) {
  const handler = (event) => {
    if (typeof callback === 'function') {
      callback(event.detail)
    }
  }
  window.addEventListener(BADGE_EVENT, handler)
  return () => window.removeEventListener(BADGE_EVENT, handler)
}
