// middleware/auditTrail.js — Journal des actions sensibles (F3 Secondaire).
// Middleware GLOBAL monté avant les routes : il pose un écouteur `res.on('finish')`
// et, une fois la réponse envoyée avec succès (2xx) sur une route jugée sensible,
// enregistre une entrée AuditLog. Fire-and-forget : n'ajoute aucune latence à la
// requête et n'échoue jamais la réponse (les erreurs d'écriture sont avalées).
//
// Choix : matcher (méthode + chemin) plutôt qu'annoter chaque route — aucune
// modification des dizaines de handlers existants, un seul point de vérité ici.
const AuditLog = require('../models/AuditLog')

// Table des actions surveillées. Chaque entrée : méthode, regex sur le chemin
// (après /api), et un libellé lisible. L'ordre n'importe pas (première correspondance).
// On cible les mutations à impact : finances, comptes, notes, sanctions, IA, école.
const RULES = [
  // Finances (frais, remises, paiements, dépenses, salaires)
  { m: 'POST', re: /^\/fees\/[^/]+\/discount$/, action: 'fee.discount', label: 'Remise appliquée sur un frais', entity: 'Fee' },
  { m: 'DELETE', re: /^\/fees\/[^/]+\/discount$/, action: 'fee.discount.remove', label: 'Remise retirée d’un frais', entity: 'Fee' },
  { m: 'POST', re: /^\/fees\/[^/]+\/record-payment$/, action: 'fee.payment', label: 'Paiement de frais enregistré', entity: 'Fee' },
  { m: 'DELETE', re: /^\/fees\/[^/]+$/, action: 'fee.delete', label: 'Frais supprimé', entity: 'Fee' },
  { m: 'POST', re: /^\/expenses$/, action: 'expense.create', label: 'Dépense enregistrée', entity: 'Expense' },
  { m: 'DELETE', re: /^\/expenses\/[^/]+$/, action: 'expense.delete', label: 'Dépense supprimée', entity: 'Expense' },
  { m: 'POST', re: /^\/salaries/, action: 'salary.create', label: 'Salaire enregistré', entity: 'Salary' },
  { m: 'DELETE', re: /^\/salaries\/[^/]+$/, action: 'salary.delete', label: 'Salaire supprimé', entity: 'Salary' },

  // Portefeuille (retraits, ajustements admin)
  { m: 'POST', re: /^\/wallet\/withdraw/, action: 'wallet.withdraw', label: 'Demande de retrait', entity: 'Wallet' },
  { m: 'POST', re: /^\/admin\/.*wallet/, action: 'wallet.admin', label: 'Opération portefeuille (admin)', entity: 'Wallet' },

  // Comptes & rôles
  { m: 'PUT', re: /^\/admin\/users\/[^/]+\/block$/, action: 'user.block', label: 'Compte bloqué/débloqué', entity: 'User' },
  { m: 'DELETE', re: /^\/admin\/users\/[^/]+$/, action: 'user.delete', label: 'Compte supprimé', entity: 'User' },
  { m: 'POST', re: /^\/staff-accounts/, action: 'staff.account', label: 'Compte personnel créé/modifié', entity: 'User' },
  { m: 'DELETE', re: /^\/staff-accounts\/[^/]+$/, action: 'staff.account.delete', label: 'Compte personnel supprimé', entity: 'User' },

  // Scolarité (notes publiées, suppression)
  { m: 'PUT', re: /^\/grades\/publish\/batch$/, action: 'grade.publish', label: 'Notes publiées', entity: 'Grade' },
  { m: 'DELETE', re: /^\/grades\/[^/]+$/, action: 'grade.delete', label: 'Note supprimée', entity: 'Grade' },

  // École (suppression = irréversible en cascade)
  { m: 'DELETE', re: /^\/schools\/[^/]+$/, action: 'school.delete', label: 'École supprimée', entity: 'School' },

  // IA enseignante
  { m: 'POST', re: /^\/ai-courses$/, action: 'aicourse.create', label: 'Cours IA programmé', entity: 'AiCourse' },
  { m: 'DELETE', re: /^\/ai-courses\/[^/]+$/, action: 'aicourse.delete', label: 'Cours IA supprimé', entity: 'AiCourse' },

  // Souscription IA (approbation = engagement financier)
  { m: 'POST', re: /^\/ai\/subscriptions\/[^/]+\/(approve|reject)$/, action: 'ai.subscription', label: 'Souscription IA traitée', entity: 'AiSubscription' },
]

// Extrait le chemin après /api, sans query string.
function normalizedPath(originalUrl) {
  const noQuery = String(originalUrl || '').split('?')[0]
  return noQuery.replace(/^\/api/, '')
}

function matchRule(method, path) {
  return RULES.find((r) => r.m === method && r.re.test(path)) || null
}

// id de la ressource ciblée : premier segment ressemblant à un ObjectId Mongo.
// Plus fiable que req.params au niveau app (params réinitialisés par couche de routeur).
function entityIdFromPath(path) {
  const seg = String(path).split('/').find((s) => /^[a-f\d]{24}$/i.test(s))
  return seg || ''
}

// Middleware global : pose l'écouteur et passe la main immédiatement.
function auditTrail(req, res, next) {
  const path = normalizedPath(req.originalUrl)
  const rule = matchRule(req.method, path)
  if (!rule) return next()

  res.on('finish', () => {
    // On ne journalise que les succès (mutation réellement appliquée)
    if (res.statusCode < 200 || res.statusCode >= 300) return
    const user = req.user // peuplé par protect pendant le traitement
    const sid = user?.school?._id || user?.school || null
    AuditLog.create({
      school: sid,
      actor: user?._id || null,
      actorName: user?.name || '',
      actorRole: user?.role || '',
      action: rule.action,
      label: rule.label,
      method: req.method,
      path,
      statusCode: res.statusCode,
      entityType: rule.entity || '',
      entityId: entityIdFromPath(path),
      ip: (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim(),
    }).catch((e) => console.error('[audit]', e.message))
  })
  next()
}

module.exports = { auditTrail, RULES }
