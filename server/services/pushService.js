const webpush = require('web-push')
const PushSubscription = require('../models/PushSubscription')

// Configuration VAPID (clés dans server/.env). Sans clés configurées, le service
// reste silencieux (best-effort) : aucune notification n'est envoyée mais rien ne casse.
const VAPID_PUBLIC = process.env.VAPID_PUBLIC || ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contact@katdschool.com'

let configured = false
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
    configured = true
  } catch (e) {
    console.error('[push] Configuration VAPID invalide :', e.message)
  }
}

function isConfigured() {
  return configured
}

// Envoie une notification push à TOUTES les souscriptions d'un utilisateur.
// Best-effort : les erreurs sont avalées (log), les endpoints expirés (404/410) sont purgés.
// payload : { title, body, url, tag, icon }
async function sendToUser(userId, payload) {
  if (!configured || !userId) return
  try {
    const subs = await PushSubscription.find({ user: userId }).lean()
    if (!subs.length) return
    const data = JSON.stringify({
      title: payload.title || 'KATD SCHÜLE',
      body: payload.body || '',
      url: payload.url || '/',
      tag: payload.tag || undefined,
      icon: payload.icon || '/icon-192.png',
    })
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: s.keys },
            data
          )
        } catch (err) {
          // Endpoint expiré / désabonné côté navigateur → on le supprime.
          if (err.statusCode === 404 || err.statusCode === 410) {
            await PushSubscription.deleteOne({ _id: s._id }).catch(() => {})
          }
        }
      })
    )
  } catch (e) {
    console.error('[push] sendToUser a échoué :', e.message)
  }
}

// Envoie à plusieurs utilisateurs (dédoublonne, ignore les valeurs nulles).
async function sendToUsers(userIds, payload) {
  if (!configured || !Array.isArray(userIds)) return
  const unique = [...new Set(userIds.filter(Boolean).map((id) => id.toString()))]
  await Promise.all(unique.map((id) => sendToUser(id, payload)))
}

// Envoie à TOUS les abonnés push de la plateforme (news/recrutement publics).
// Borné par construction : on ne parcourt que les utilisateurs ayant une
// souscription push enregistrée, pas toute la table User.
async function sendToAllSubscribers(payload, excludeId) {
  if (!configured) return
  try {
    const ids = await PushSubscription.distinct('user')
    const ex = excludeId?.toString()
    await Promise.all(
      ids.filter((id) => id && id.toString() !== ex).map((id) => sendToUser(id, payload))
    )
  } catch (e) {
    console.error('[push] sendToAllSubscribers a échoué :', e.message)
  }
}

module.exports = { sendToUser, sendToUsers, sendToAllSubscribers, isConfigured, VAPID_PUBLIC }
