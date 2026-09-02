require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const compression = require('compression')
const connectDB = require('./config/db')

const app = express()

connectDB()

// Tâches planifiées in-process (intérêt quotidien directeur + maintenance mensuelle).
try { require('./jobs/scheduler').start() } catch (e) { console.error('scheduler:', e.message) }

// Diffusion ponctuelle des cours de l'IA enseignante (tick 45 s).
try { require('./jobs/aiCourseRunner').start() } catch (e) { console.error('aiCourseRunner:', e.message) }

// Publication différée des annonces programmées (tick 60 s).
try { require('./jobs/announcementRunner').start() } catch (e) { console.error('announcementRunner:', e.message) }

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
// Limite relevée à 60 Mo : les messages vocaux/images/vidéos sont envoyés en
// data URL (base64) via JSON. La limite Express par défaut (100 Ko) bloquait
// tout vocal de plus de ~30 s. 60 Mo couvre plusieurs minutes d'audio.
app.use(express.json({ limit: '60mb', verify: (req, res, buf) => { req.rawBody = buf && buf.toString('utf8') } }))
app.use(express.urlencoded({ extended: true, limit: '60mb' }))

app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Journal des actions sensibles (F3) : écouteur global, n'enregistre que les
// mutations surveillées ayant réussi. Monté avant les routes.
app.use(require('./middleware/auditTrail').auditTrail)

app.use('/api/auth', require('./routes/auth'))
const paymentsRouter = require('./routes/payments')
app.use('/api/payments', paymentsRouter)
// Alias court pour la passerelle de paiement Ikeepay : https://<domaine>/api/webhook
// (identique à /api/payments/webhook). Ikeepay attend ce format court dans sa configuration.
app.post('/api/webhook', paymentsRouter.webhookHandler)
// Boosts (monétisation espace social). /api/admin/boosts AVANT /api/admin (walletAdmin) pour priorité.
app.use('/api/boosts', require('./routes/boosts'))
app.use('/api/admin/boosts', require('./routes/adminBoosts'))
app.use('/api/wallet', require('./routes/wallet'))
app.use('/api/merchant', require('./routes/merchant'))
app.use('/api/shareholders', require('./routes/shareholders'))
app.use('/api/admin/merchants', require('./routes/adminMerchants'))
app.use('/api/admin/users', require('./routes/adminUsers'))
app.use('/api/admin', require('./routes/walletAdmin'))
app.use('/api/schools', require('./routes/schools'))
app.use('/api/students', require('./routes/students'))
app.use('/api/parents', require('./routes/parents'))
app.use('/api/teachers', require('./routes/teachers'))
app.use('/api/staff', require('./routes/staff'))
app.use('/api/staff-accounts', require('./routes/staffAccounts'))
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
app.use('/api/youtube', require('./routes/youtube'))
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
app.use('/api/entry-attendance', require('./routes/entryAttendance'))
app.use('/api/visitors', require('./routes/visitors'))
app.use('/api/teacher-files', require('./routes/teacherFiles'))
app.use('/api/mails', require('./routes/mails'))
app.use('/api/permissions', require('./routes/permissions'))
app.use('/api/sanctions', require('./routes/sanctions'))
app.use('/api/reports', require('./routes/reports'))
app.use('/api/lesson-logs', require('./routes/lessonLogs'))
app.use('/api/notifications', require('./routes/notifications'))
app.use('/api/presence', require('./routes/presence'))
app.use('/api/ai', require('./routes/ai'))
app.use('/api/ai-courses', require('./routes/aiCourses'))
app.use('/api/banners', require('./routes/banners'))
app.use('/api/recruitment', require('./routes/recruitment'))
app.use('/api/tutoring', require('./routes/tutoring'))
app.use('/api/news', require('./routes/news'))
app.use('/api/push', require('./routes/push'))
app.use('/api/uploads', require('./routes/uploads'))
app.use('/api/audit-logs', require('./routes/auditLogs'))

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'KATD-SCHÜLE API is running',
    timestamp: new Date().toISOString(),
  })
})
// GET /api/smtp-test?secret=<JWT_SECRET_8_premiers_chars> — diagnostic SMTP (super_admin uniquement)
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

// GET /ads.txt — fichier requis par Google AdSense pour autoriser la monétisation du domaine.
// Généré dynamiquement à partir de l'ID éditeur configuré (dashboard admin → YouTube/AdSense).
// Renvoie une ligne vide (200) tant qu'aucun ID n'est configuré, pour éviter une 404 côté Google.
app.get('/ads.txt', async (req, res) => {
  res.type('text/plain')
  try {
    const youtube = require('./services/youtubeService')
    const cfg = await youtube.resolveConfig()
    const client = (cfg.adsenseClient || '').trim()
    // Format officiel : google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
    const pub = client.replace(/^ca-/, '') // ads.txt attend "pub-…" (sans le préfixe "ca-")
    if (pub) return res.send(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`)
  } catch (_) { /* repli ligne vide */ }
  res.send('')
})

// ── Service du build React (hébergement cPanel : une seule app Node sert l'API ET le site) ──
// En production (SERVE_CLIENT=true ou NODE_ENV=production), on sert client/dist et on renvoie
// index.html pour toute route non-API (repli SPA de React Router). Ainsi, plus besoin de Nginx :
// l'app Node lancée par cPanel (« Setup Node.js App » / Passenger) sert tout le site.
const SERVE_CLIENT = process.env.SERVE_CLIENT === 'true' || process.env.NODE_ENV === 'production'
if (SERVE_CLIENT) {
  const fs = require('fs')
  const clientDist = path.join(__dirname, '..', 'client', 'dist')
  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist))
    // Repli SPA : toute requête GET restante (hors /api et /uploads, déjà gérés plus haut) → index.html.
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
      res.sendFile(path.join(clientDist, 'index.html'))
    })
  } else {
    console.warn('[serve-client] client/dist/index.html introuvable — build client non déployé ?')
  }
}

// 404 (routes API non trouvées, ou requêtes non-GET hors API) → réponse JSON.
app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée' })
})

// Gestionnaire d'erreurs — enregistré en dernier (convention Express).
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: err.message || 'Erreur serveur interne' })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`🚀 Serveur KATD-SCHÜLE démarré sur http://localhost:${PORT}`)
})