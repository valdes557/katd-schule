const express = require('express')
const router = express.Router()
const { cloudinary } = require('../config/cloudinary')
const { protect } = require('../middleware/auth')

// POST /api/uploads/sign — renvoie une signature Cloudinary pour un upload DIRECT
// depuis le navigateur (le fichier ne transite plus par le VPS). Le secret Cloudinary
// reste côté serveur ; seule la signature calculée est renvoyée.
// body : { folder?, resourceType? }
router.post('/sign', protect, async (req, res) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET
    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ message: 'Cloudinary non configuré' })
    }

    const folder = (req.body && req.body.folder) || 'katd-schule/videos'
    const resourceType = (req.body && req.body.resourceType) || 'auto'
    // Timestamp en secondes (Cloudinary l'exige pour la signature).
    const timestamp = Math.round(Date.now() / 1000)

    // On signe uniquement les paramètres qui seront envoyés à Cloudinary.
    const paramsToSign = { folder, timestamp }
    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret)

    res.json({
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder,
      resourceType,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
