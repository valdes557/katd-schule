// Helpers de fuseau horaire partagés (pointage enseignants + entrées/sorties QR).
// Le VPS tourne en UTC alors que les heures sont saisies en heure locale du Cameroun :
// toutes les comparaisons d'heures se font dans APP_TZ, à la minute près.
const APP_TZ = process.env.APP_TZ || 'Africa/Douala'

// Décompose une date dans le fuseau APP_TZ (année, mois, jour, heure, minute)
function tzParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date)
  const get = (t) => parts.find((p) => p.type === t)?.value
  return { y: get('year'), mo: get('month'), d: get('day'), h: Number(get('hour')) % 24, mi: Number(get('minute')) }
}

// Jour courant au format YYYY-MM-DD (fuseau APP_TZ)
function todayKey(d = new Date()) {
  const p = tzParts(d)
  return `${p.y}-${p.mo}-${p.d}`
}

// Convertit "HH:MM" → minutes depuis minuit
function hhmmToMinutes(s) {
  if (!s || typeof s !== 'string') return null
  const [h, m] = s.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

// Minutes depuis minuit dans le fuseau APP_TZ
function minutesOfDay(date) {
  const p = tzParts(date)
  return p.h * 60 + p.mi
}

function fmtTime(date) {
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: APP_TZ })
}

module.exports = { APP_TZ, tzParts, todayKey, hhmmToMinutes, minutesOfDay, fmtTime }
