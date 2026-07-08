const express = require('express')
const router = express.Router()
const PushSubscription = require('../models/PushSubscription')
const { protect } = require('../middleware/auth')
const { VAPID_PUBLIC } = require('../services/pushService')

// GET /api/push/vapid — clé publique VAPID (nécessaire côté client pour s'abonner).
// Route publique : la clé publique n'est pas un secret.
router.get('/vapid', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC || '' })
})

// POST /api/push/subscribe — enregistre (ou met à jour) l'abonnement du navigateur courant.
// body : { endpoint, keys:{ p256dh, auth } }
router.post('/subscribe', protect, async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {}
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ message: 'Abonnement push invalide' })
    }
    // Upsert par endpoint : ré-abonner le même navigateur met à jour le propriétaire.
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        user: req.user._id,
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
        userAgent: (req.headers['user-agent'] || '').slice(0, 300),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/push/unsubscribe — supprime l'abonnement du navigateur courant.
// body : { endpoint }
router.post('/unsubscribe', protect, async (req, res) => {
  try {
    const { endpoint } = req.body || {}
    if (endpoint) await PushSubscription.deleteOne({ endpoint })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
