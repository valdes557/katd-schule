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
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf && buf.toString('utf8') } }))
app.use(express.urlencoded({ extended: true }))

app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.use('/api/auth', require('./routes/auth'))
app.use('/api/payments', require('./routes/payments'))
app.use('/api/wallet', require('./routes/wallet'))
app.use('/api/admin', require('./routes/walletAdmin'))
app.use('/api/schools', require('./routes/schools'))
app.use('/api/students', require('./routes/students'))
app.use('/api/parents', require('./routes/parents'))
app.use('/api/teachers', require('./routes/teachers'))
app.use('/api/staff', require('./routes/staff'))
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
app.use('/api/announcements', require('./routes/announcements'))
app.use('/api/documents', require('./routes/documents'))
app.use('/api/events', require('./routes/events'))
app.use('/api/teacher-attendance', require('./routes/teacherAttendance'))
app.use('/api/notifications', require('./routes/notifications'))
app.use('/api/presence', require('./routes/presence'))
app.use('/api/ai', require('./routes/ai'))
app.use('/api/banners', require('./routes/banners'))

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'KATD-SCHÜLE API is running',
    timestamp: new Date().toISOString(),
  })
})

// GET /api/smtp-test?secret=<JWT_SECRET_4_premiers_chars> — diagnostic SMTP (super_admin uniquement)
// Exemple : /api/smtp-test?secret=f34a&to=admin@gmail.com
app.get('/api/smtp-test', async (req, res) => {
  const { secret, to } = req.query
  // Protection minimale : les 8 premiers caractères du JWT_SECRET
  const expected = (process.env.JWT_SECRET || '').slice(0, 8)
  if (!secret || secret !== expected) {
    return res.status(403).json({ message: 'Accès refusé' })
  }
  const { sendEmail } = require('./utils/emailService')
  const dest = to || process.env.SMTP_USER
  const result = await sendEmail({
    to: dest,
    subject: '✅ Test SMTP — KATD-SCHÜLE',
    html: `<p>Si vous recevez cet email, le SMTP fonctionne correctement sur le VPS.</p><p>Heure : ${new Date().toISOString()}</p>`,
  })
  res.json({
    smtp_user: process.env.SMTP_USER || '(non défini)',
    smtp_from: process.env.SMTP_FROM || 'contact@katdschool.com',
    smtp_host: process.env.SMTP_HOST || '(non défini)',
    smtp_port: process.env.SMTP_PORT || '(non défini)',
    smtp_pass_length: (process.env.SMTP_PASS || '').replace(/\s/g, '').length,
    destination: dest,
    result,
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