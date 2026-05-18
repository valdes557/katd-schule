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
