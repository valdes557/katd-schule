// jobs/announcementRunner.js — Publication différée des annonces programmées (G2).
// Le Principal (ou la secrétaire) peut programmer une annonce à une date/heure future
// (`status: 'programmee'`, `scheduledAt`). Ce runner tick toutes les 60 s : chaque
// annonce arrivée à échéance passe atomiquement à `publiee` (idempotence garantie par
// la condition `status: 'programmee'` du findOneAndUpdate) puis le push est envoyé —
// exactement comme une publication immédiate.
const Announcement = require('../models/Announcement')
const { pushAnnouncement } = require('../routes/announcements')

const TICK_MS = 60 * 1000

async function publishDue(now) {
  // Toutes les annonces programmées dont l'heure est atteinte.
  const due = await Announcement.find({
    status: 'programmee',
    scheduledAt: { $ne: null, $lte: now },
  }).limit(50)

  for (const a of due) {
    // Transition atomique : protège du double tick / redémarrage en pleine publication.
    const published = await Announcement.findOneAndUpdate(
      { _id: a._id, status: 'programmee' },
      { $set: { status: 'publiee', publishedAt: now } },
      { new: true }
    )
    if (!published) continue
    if (typeof pushAnnouncement === 'function') pushAnnouncement(published)
    console.log(`[announcement] publiée (programmée) : « ${published.title || 'Annonce'} »`)
  }
}

async function tick() {
  const now = new Date()
  try { await publishDue(now) } catch (e) { console.error('[announcement:publish]', e.message) }
}

let timer = null
function start() {
  if (timer) return
  // Premier passage peu après le démarrage (laisse la connexion Mongo s'établir).
  setTimeout(tick, 25 * 1000)
  timer = setInterval(tick, TICK_MS)
  console.log('📣 Runner annonces démarré (tick 60 s : publication des annonces programmées)')
}

module.exports = { start, tick }
