require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const path = require('path')
const compression = require('compression')
const connectDB = require('./config/db')

const app = express()

connectDB()

// Security headers
app.use(helmet())

// Gzip/Brotli responses for faster transfers
app.use(compression())

// Rate limiting — general API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes, réessayez dans 15 minutes.' },
})
app.use('/api/', apiLimiter)

// Stricter rate limit for auth endpoints (login, register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives, réessayez dans 15 minutes.' },
})
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    // Allow all localhost / 127.0.0.1 origins in development
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return cb(null, true)
    }
    // Allow Vercel preview deployments
    if (/\.vercel\.app$/.test(origin)) return cb(null, true)
    // Allow configured CLIENT_URL
    const allowed = (process.env.CLIENT_URL || '').split(',').map((o) => o.trim()).filter(Boolean)
    if (allowed.includes(origin)) return cb(null, true)
    // In production, reject unknown origins
    if (process.env.NODE_ENV === 'production') {
      return cb(new Error('Origin not allowed by CORS'))
    }
    return cb(null, true)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
// Handle CORS preflight globally
app.options('*', cors())
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.use('/api/auth', require('./routes/auth'))
app.use('/api/schools', require('./routes/schools'))
app.use('/api/students', require('./routes/students'))
app.use('/api/teachers', require('./routes/teachers'))
app.use('/api/classes', require('./routes/classes'))
app.use('/api/grades', require('./routes/grades'))
app.use('/api/attendance', require('./routes/attendance'))
app.use('/api/messages', require('./routes/messages'))
app.use('/api/media', require('./routes/media'))
app.use('/api/dashboard', require('./routes/dashboard'))
app.use('/api/enrollments', require('./routes/enrollments'))
app.use('/api/locations', require('./routes/locations'))
app.use('/api/school-registrations', require('./routes/schoolRegistrations'))
app.use('/api/school-pages', require('./routes/schoolPages'))
app.use('/api/platform', require('./routes/platform'))
app.use('/api/subjects', require('./routes/subjects'))
app.use('/api/timetables', require('./routes/timetables'))
app.use('/api/parent', require('./routes/parent'))
app.use('/api/teacher', require('./routes/teacher'))
app.use('/api/fees', require('./routes/fees'))

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'KATD-SCHÜLE API is running',
    timestamp: new Date().toISOString(),
  })
})

app.use((err, req, res, next) => {
  console.error(err.stack)
  const message = process.env.NODE_ENV === 'production'
    ? 'Erreur serveur interne'
    : (err.message || 'Erreur serveur interne')
  res.status(500).json({ message })
})

app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée' })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`🚀 Serveur KATD-SCHÜLE démarré sur http://localhost:${PORT}`)
})
