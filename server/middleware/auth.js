const jwt = require('jsonwebtoken')
const User = require('../models/User')

const protect = async (req, res, next) => {
  let token

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1]
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
      next()
    } catch (error) {
      return res.status(401).json({ message: 'Token invalide ou expiré' })
    }
  } else {
    return res.status(401).json({ message: 'Non autorisé, token manquant' })
  }
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

module.exports = { protect, authorize }
