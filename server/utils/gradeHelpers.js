/**
 * Pure helper functions for grade computation.
 * Extracted from routes/grades.js for reuse and testability.
 */

function weightedAverage(items) {
  const totalCoef = items.reduce((s, i) => s + (i.coefficient || 1), 0)
  if (totalCoef === 0) return 0
  return items.reduce((s, i) => s + i.value * (i.coefficient || 1), 0) / totalCoef
}

function appreciationFor(avg) {
  if (avg >= 18) return 'Excellent travail ! Continue ainsi.'
  if (avg >= 16) return 'Très bonne maîtrise. Félicitations.'
  if (avg >= 14) return 'Bon travail. Continue sur cette voie !'
  if (avg >= 12) return 'Résultats encourageants. Persévère.'
  if (avg >= 10) return 'Travail moyen. Peux mieux faire.'
  if (avg >= 8) return 'Résultats insuffisants. Plus d\'efforts requis.'
  return 'Niveau préoccupant. Travail à reprendre.'
}

function behaviorFor(attendanceRate) {
  if (attendanceRate >= 95) return 'Très bien'
  if (attendanceRate >= 85) return 'Bien'
  if (attendanceRate >= 70) return 'Assez bien'
  return 'À améliorer'
}

module.exports = { weightedAverage, appreciationFor, behaviorFor }
