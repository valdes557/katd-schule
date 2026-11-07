const jwt = require('jsonwebtoken')
const User = require('../models/User')

function extractToken(req) {
  try {
    if (req.headers && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ')
      if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
        const t = parts[1].trim()
        if (t && t !== 'null' && t !== 'undefined') return t
      } else {
        const raw = req.headers.authorization.trim()
        if (raw && raw !== 'null' && raw !== 'undefined') return raw
      }
    }
    if (req.headers && req.headers['x-auth-token']) {
      const t = String(req.headers['x-auth-token']).trim()
      if (t && t !== 'null' && t !== 'undefined') return t
    }
    if (req.headers && req.headers['x-access-token']) {
      const t = String(req.headers['x-access-token']).trim()
      if (t && t !== 'null' && t !== 'undefined') return t
    }
    if (req.query && req.query.token) {
      const t = String(req.query.token).trim()
      if (t && t !== 'null' && t !== 'undefined') return t
    }
    if (req.body && typeof req.body === 'object' && req.body.token) {
      const t = String(req.body.token).trim()
      if (t && t !== 'null' && t !== 'undefined') return t
    }
    if (req.cookies && (req.cookies.token || req.cookies.katd_token)) {
      const t = String(req.cookies.token || req.cookies.katd_token).trim()
      if (t && t !== 'null' && t !== 'undefined') return t
    }
  } catch (_) {}
  return null
}

const protect = async (req, res, next) => {
  const token = extractToken(req)

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      req.user = await User.findById(decoded.id).select('-password').populate('school')
      if (!req.user) {
        return res.status(401).json({ message: 'Utilisateur non trouvé' })
      }
      if (req.user.isActive === false) {
        return res.status(403).json({ message: 'Votre compte a été bloqué. Contactez l\'administration.' })
      }
      // Souscription de l'établissement désactivée par l'admin → directeur, enseignants,
      // parents et élèves de cette école perdent l'accès (le super_admin n'est pas concerné).
      if (req.user.role !== 'super_admin' && req.user.school?.subscription?.status === 'suspended') {
        return res.status(403).json({ message: 'La souscription de votre établissement est désactivée. Contactez l\'administrateur.' })
      }
      // Essai gratuit expiré OU abonnement non payé → blocage du directeur, du personnel et des parents
      // (jusqu'au paiement par le directeur). On exempte les routes paiement/auth pour permettre le déblocage.
      if (req.user.role !== 'super_admin' && req.user.school && typeof req.user.school.hasActiveAccess === 'function') {
        const _url = req.originalUrl || ''
        const _exempt = _url.includes('/api/payments') || _url.includes('/api/auth') || _url.includes('/api/schools/access-status')
        if (!_exempt && !req.user.school.hasActiveAccess()) {
          const _sub = req.user.school.subscription || {}
          return res.status(403).json({
            code: 'SUBSCRIPTION_EXPIRED',
            role: req.user.role,
            plan: _sub.plan || null,
            message: req.user.role === 'directeur'
              ? "Votre periode d'essai est terminee. Veuillez payer votre souscription pour reactiver l'acces."
              : "L'acces est temporairement bloque. La souscription de votre etablissement doit etre renouvelee par le directeur."
          })
        }
      }
      next()
    } catch (error) {
      return res.status(401).json({ message: 'Token invalide ou expiré' })
    }
  } else {
    return res.status(401).json({ message: 'Non autorisé, token manquant' })
  }
}

const protectOptional = async (req, res, next) => {
  const token = extractToken(req)

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      req.user = await User.findById(decoded.id).select('-password').populate('school')
    } catch (_) {
      // Ignorer l'erreur pour un accès optionnel
    }
  }
  next()
}

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Accès refusé. Rôle requis : ${roles.join(', ')}`,
      })
    }
    next()
  }
}

module.exports = { protect, protectOptional, authorize }