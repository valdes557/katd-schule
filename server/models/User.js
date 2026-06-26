const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ['super_admin', 'directeur', 'enseignant', 'parent', 'eleve', 'utilisateur'],
      default: 'directeur',
    },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    phone: { type: String },
    avatar: { type: String },
    matricule: { type: String, unique: true, sparse: true },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    // Suivi de présence (statut en ligne)
    lastLogout: { type: Date },
    lastActivity: { type: Date },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    bio: { type: String, default: '' },
    cover: { type: String, default: '' },
    twoFactorEnabled: { type: Boolean, default: false },
    // Accès à l'agent IA accordé par le directeur (enseignants/parents). Les
    // directeurs disposent de l'accès d'office si l'école a une souscription IA.
    aiAccess: { type: Boolean, default: false },
    aiAccessGrantedAt: { type: Date },
    // Date de dernière consultation par rubrique (clé → Date) pour les badges de nouveautés
    rubricSeen: { type: Map, of: Date, default: {} },
    // Sécurité authentification (Lot 6)
    emailVerified: { type: Boolean, default: false },
    emailVerifyCode: { type: String, default: null, select: false },
    emailVerifyExpires: { type: Date, default: null, select: false },
    resetPasswordCode: { type: String, default: null, select: false },
    resetPasswordExpires: { type: Date, default: null, select: false },
    loginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },
    // Code PIN portefeuille (haché) pour transferts/retraits
    walletPin: { type: String, default: null, select: false },
    pinResetCode: { type: String, default: null, select: false },
    pinResetExpires: { type: Date, default: null, select: false },
  },
  { timestamps: true }
)

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password)
}

userSchema.methods.matchPin = async function (enteredPin) {
  if (!this.walletPin) return false
  return await bcrypt.compare(String(enteredPin), this.walletPin)
}

userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now())
}

userSchema.methods.toJSON = function () {
  const obj = this.toObject()
  delete obj.password
  delete obj.walletPin
  delete obj.pinResetCode
  delete obj.pinResetExpires
  delete obj.emailVerifyCode
  delete obj.emailVerifyExpires
  delete obj.resetPasswordCode
  delete obj.resetPasswordExpires
  delete obj.loginAttempts
  delete obj.lockUntil
  return obj
}

module.exports = mongoose.model('User', userSchema)