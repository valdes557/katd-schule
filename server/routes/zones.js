// server/routes/zones.js — Gestion des zones géographiques (Arrondissements, Régions, National, International)
const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth')
const GeographicZone = require('../models/GeographicZone')
const User = require('../models/User')
const Shareholding = require('../models/Shareholding')

// Middleware super_admin
const superAdminOnly = (req, res, next) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ message: 'Accès réservé au Super Administrateur' })
  }
  next()
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES PUBLIQUES / UTILISATEURS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/zones — Liste des zones actives (optionnellement filtrées par type)
router.get('/', async (req, res) => {
  try {
    const { type } = req.query
    const filter = { isActive: true }
    if (type && ['arrondissement', 'regional', 'national', 'international'].includes(type)) {
      filter.type = type
    }

    const zones = await GeographicZone.find(filter)
      .sort({ type: 1, order: 1, name: 1 })
      .lean()

    res.json({ success: true, zones })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES SUPER ADMINISTRATEUR
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/zones/admin — Liste complète de toutes les zones avec statistiques
router.get('/admin', protect, superAdminOnly, async (req, res) => {
  try {
    const zones = await GeographicZone.find().sort({ type: 1, order: 1, name: 1 }).lean()

    // Calcul des statistiques par zone
    const [userCounts, shareCounts] = await Promise.all([
      User.aggregate([
        { $match: { 'geographicZone.zoneId': { $ne: null } } },
        { $group: { _id: '$geographicZone.zoneId', count: { $sum: 1 } } },
      ]),
      Shareholding.aggregate([
        { $match: { zoneId: { $ne: null } } },
        { $group: { _id: '$zoneId', count: { $sum: 1 } } },
      ]),
    ])

    const userCountMap = {}
    userCounts.forEach((u) => {
      if (u._id) userCountMap[String(u._id)] = u.count
    })

    const shareCountMap = {}
    shareCounts.forEach((s) => {
      if (s._id) shareCountMap[String(s._id)] = s.count
    })

    const enrichedZones = zones.map((z) => ({
      ...z,
      usersCount: userCountMap[String(z._id)] || 0,
      shareholdersCount: shareCountMap[String(z._id)] || 0,
    }))

    // Comptage des utilisateurs sans zone
    const unassignedUsersCount = await User.countDocuments({
      $or: [
        { 'geographicZone.zoneId': null },
        { 'geographicZone.zoneName': { $in: ['', null] } },
        { geographicZone: { $exists: false } },
      ],
    })

    res.json({
      success: true,
      zones: enrichedZones,
      unassignedUsersCount,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/zones/admin — Création d'une zone géographique
router.post('/admin', protect, superAdminOnly, async (req, res) => {
  try {
    const { type, name, code = '', country = 'Cameroun', description = '', order = 0, isActive = true } = req.body

    if (!type || !['arrondissement', 'regional', 'national', 'international'].includes(type)) {
      return res.status(400).json({ message: 'Type de zone invalide (arrondissement, regional, national, international requis).' })
    }

    const cleanName = String(name || '').trim()
    if (!cleanName) {
      return res.status(400).json({ message: 'Le nom de la zone géographique est obligatoire.' })
    }

    const cleanCountry = String(country || 'Cameroun').trim()
    const cleanCode = String(code || '').trim().toUpperCase()

    // Vérifier si elle existe déjà
    const existing = await GeographicZone.findOne({
      type,
      name: { $regex: new RegExp(`^${cleanName}$`, 'i') },
      country: { $regex: new RegExp(`^${cleanCountry}$`, 'i') },
    })

    if (existing) {
      return res.status(400).json({ message: `Une zone de type « ${type} » nommée « ${cleanName} » existe déjà pour ce pays.` })
    }

    const zone = await GeographicZone.create({
      type,
      name: cleanName,
      code: cleanCode,
      country: cleanCountry,
      description: String(description || '').trim(),
      order: Number(order) || 0,
      isActive: isActive !== false,
    })

    res.status(201).json({
      success: true,
      message: `Zone « ${zone.name} » créée avec succès !`,
      zone,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/zones/admin/:id — Modification d'une zone géographique
router.put('/admin/:id', protect, superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const { name, code, country, description, order, isActive, type } = req.body

    const zone = await GeographicZone.findById(id)
    if (!zone) {
      return res.status(404).json({ message: 'Zone géographique introuvable.' })
    }

    if (type && ['arrondissement', 'regional', 'national', 'international'].includes(type)) {
      zone.type = type
    }
    if (name) zone.name = String(name).trim()
    if (code !== undefined) zone.code = String(code).trim().toUpperCase()
    if (country !== undefined) zone.country = String(country).trim()
    if (description !== undefined) zone.description = String(description).trim()
    if (order !== undefined) zone.order = Number(order) || 0
    if (isActive !== undefined) zone.isActive = Boolean(isActive)

    await zone.save()

    // Si le nom ou le type a changé, synchronise les utilisateurs rattachés
    if (name || type) {
      await User.updateMany(
        { 'geographicZone.zoneId': zone._id },
        {
          $set: {
            'geographicZone.zoneName': zone.name,
            'geographicZone.zoneType': zone.type,
          },
        }
      )
    }

    res.json({
      success: true,
      message: `Zone « ${zone.name} » mise à jour avec succès !`,
      zone,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/zones/admin/:id — Suppression d'une zone géographique
router.delete('/admin/:id', protect, superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const zone = await GeographicZone.findById(id)
    if (!zone) {
      return res.status(404).json({ message: 'Zone géographique introuvable.' })
    }

    // Vérifie si des utilisateurs ou actionnaires y sont liés
    const [userCount, shareCount] = await Promise.all([
      User.countDocuments({ 'geographicZone.zoneId': zone._id }),
      Shareholding.countDocuments({ zoneId: zone._id }),
    ])

    if (userCount > 0 || shareCount > 0) {
      return res.status(400).json({
        message: `Impossible de supprimer cette zone : elle est déjà attribuée à ${userCount} utilisateur(s) et ${shareCount} souscription(s) d'actionnaire. Vous pouvez plutôt la désactiver.`,
      })
    }

    await GeographicZone.findByIdAndDelete(id)

    res.json({
      success: true,
      message: `Zone « ${zone.name} » supprimée avec succès !`,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/zones/admin/users — Liste paginée et filtrable des utilisateurs pour attribution de zone
router.get('/admin/users', protect, superAdminOnly, async (req, res) => {
  try {
    const { search = '', zoneType = '', zoneId = '', unassigned = 'false', page = 1, limit = 50 } = req.query

    const filter = {}

    // Filtre recherche par texte
    if (search.trim()) {
      const q = search.trim()
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ]
    }

    // Filtre non assignés
    if (unassigned === 'true' || unassigned === true) {
      filter.$and = filter.$and || []
      filter.$and.push({
        $or: [
          { 'geographicZone.zoneId': null },
          { 'geographicZone.zoneName': { $in: ['', null] } },
          { geographicZone: { $exists: false } },
        ],
      })
    } else {
      if (zoneType && ['arrondissement', 'regional', 'national', 'international'].includes(zoneType)) {
        filter['geographicZone.zoneType'] = zoneType
      }
      if (zoneId) {
        filter['geographicZone.zoneId'] = zoneId
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(10, parseInt(limit, 10) || 50))
    const skip = (pageNum - 1) * limitNum

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('name email phone role geographicZone createdAt isActive emailVerified')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ])

    res.json({
      success: true,
      users,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/zones/admin/assign-user — Attribution ou modification de la zone d'un utilisateur existant
router.put('/admin/assign-user', protect, superAdminOnly, async (req, res) => {
  try {
    const { userId, zoneId } = req.body

    if (!userId) {
      return res.status(400).json({ message: "L'identifiant de l'utilisateur (userId) est obligatoire." })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' })
    }

    // Si zoneId est null ou vide -> désassigne
    if (!zoneId) {
      user.geographicZone = {
        zoneId: null,
        zoneType: null,
        zoneName: '',
      }
      await user.save()
      return res.json({
        success: true,
        message: `Zone géographique retirée pour l'utilisateur ${user.name}.`,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          geographicZone: user.geographicZone,
        },
      })
    }

    const zone = await GeographicZone.findById(zoneId)
    if (!zone) {
      return res.status(404).json({ message: 'Zone géographique sélectionnée introuvable.' })
    }

    user.geographicZone = {
      zoneId: zone._id,
      zoneType: zone.type,
      zoneName: zone.name,
    }
    await user.save()

    res.json({
      success: true,
      message: `L'utilisateur ${user.name} a été attribué avec succès à la zone « ${zone.name} » (${zone.type.toUpperCase()}).`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        geographicZone: user.geographicZone,
      },
      zone,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
