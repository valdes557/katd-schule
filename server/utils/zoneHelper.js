// utils/zoneHelper.js — Gestion centralisée et normalisation des zones géographiques
const mongoose = require('mongoose')

/**
 * Construit l'objet geographicZone normalisé à partir des champs du corps de requête.
 */
function buildGeographicZone(body = {}) {
  const validId = (id) => (id && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null)

  const arrId = validId(body.arrondissementId)
  const regId = validId(body.regionId)
  const ctryId = validId(body.countryId)
  const mondId = validId(body.mondialId)
  const zId = validId(body.zoneId)

  let primaryId = zId
  let primaryType = body.zoneType || null
  let primaryName = body.zoneName || ''

  if (!primaryId) {
    if (arrId) {
      primaryId = arrId
      primaryType = 'arrondissement'
      primaryName = body.arrondissementName || ''
    } else if (regId) {
      primaryId = regId
      primaryType = 'regional'
      primaryName = body.regionName || ''
    } else if (ctryId) {
      primaryId = ctryId
      primaryType = 'national'
      primaryName = body.countryName || 'Cameroun'
    } else if (mondId) {
      primaryId = mondId
      primaryType = 'mondial'
      primaryName = body.mondialName || 'International'
    }
  }

  const allZoneIds = [arrId, regId, ctryId, mondId, zId].filter(Boolean)

  return {
    zoneId: primaryId,
    zoneType: primaryType,
    zoneName: primaryName,
    arrondissementId: arrId,
    arrondissementName: body.arrondissementName || '',
    regionId: regId,
    regionName: body.regionName || '',
    countryId: ctryId,
    countryName: body.countryName || 'Cameroun',
    mondialId: mondId,
    mondialName: body.mondialName || '',
    allZoneIds,
    assignedAt: new Date(),
  }
}

/**
 * Résout la zone géographique pour un membre créé par une école (élève, parent, enseignant, personnel).
 * RÈGLE MÉTIER : Si le directeur/principal assigne explicitement une zone, on utilise celle-ci.
 * Sinon, le membre hérite PAR DÉFAUT de la zone géographique de son établissement.
 */
function resolveMemberZone(reqBody = {}, schoolDoc = null) {
  const hasExplicitZone =
    reqBody.zoneId ||
    reqBody.arrondissementId ||
    reqBody.regionId ||
    reqBody.countryId ||
    reqBody.mondialId ||
    (reqBody.geographicZone && (reqBody.geographicZone.zoneId || reqBody.geographicZone.arrondissementId))

  if (hasExplicitZone) {
    const raw = reqBody.geographicZone || reqBody
    return buildGeographicZone(raw)
  }

  // Héritage par défaut de la zone de l'établissement
  if (schoolDoc && schoolDoc.geographicZone && (schoolDoc.geographicZone.zoneId || schoolDoc.geographicZone.arrondissementId || schoolDoc.geographicZone.regionId)) {
    const sz = schoolDoc.geographicZone
    return {
      zoneId: sz.zoneId || null,
      zoneType: sz.zoneType || null,
      zoneName: sz.zoneName || '',
      arrondissementId: sz.arrondissementId || null,
      arrondissementName: sz.arrondissementName || '',
      regionId: sz.regionId || null,
      regionName: sz.regionName || '',
      countryId: sz.countryId || null,
      countryName: sz.countryName || 'Cameroun',
      mondialId: sz.mondialId || null,
      mondialName: sz.mondialName || '',
      allZoneIds: Array.isArray(sz.allZoneIds) ? sz.allZoneIds : (sz.zoneId ? [sz.zoneId] : []),
      assignedAt: new Date(),
    }
  }

  return {
    zoneId: null,
    zoneType: null,
    zoneName: '',
    arrondissementId: null,
    arrondissementName: '',
    regionId: null,
    regionName: '',
    countryId: null,
    countryName: 'Cameroun',
    mondialId: null,
    mondialName: '',
    allZoneIds: [],
  }
}

module.exports = {
  buildGeographicZone,
  resolveMemberZone,
}
