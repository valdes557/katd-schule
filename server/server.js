require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const compression = require('compression')
const connectDB = require('./config/db')

const app = express()

connectDB()

// Gzip/Brotli responses for faster transfers
app.use(compression())

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    // Allow all localhost / 127.0.0.1 origins in development
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true)
    // Allow Vercel preview deployments
    if (/\.vercel\.app$/.test(origin)) return cb(null, true)
    // Allow configured CLIENT_URL
    const allowed = (process.env.CLIENT_URL || '').split(',').map((o) => o.trim()).filter(Boolean)
    if (allowed.includes(origin)) return cb(null, true)
    return cb(null, true) // Allow all in dev; restrict in production if needed
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
// Handle CORS preflight globally
app.options('*', cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.use('/api/auth', require('./routes/auth'))
app.use('/api/schools', require('./routes/schools'))
app.use('/api/students', require('./routes/students'))
app.use('/api/parents', require('./routes/parents'))
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
app.use('/api/expenses', require('./routes/expenses'))
app.use('/api/salaries', require('./routes/salaries'))

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'KATD-SCHÜLE API is running',
    timestamp: new Date().toISOString(),
  })
})

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: err.message || 'Erreur serveur interne' })
})

app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée' })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`🚀 Serveur KATD-SCHÜLE démarré sur http://localhost:${PORT}`)
})
