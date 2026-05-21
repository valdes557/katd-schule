require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const connectDB = require('./config/db')

const app = express()

connectDB()

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    if (/\.vercel\.app$/.test(new URL(origin).hostname)) return cb(null, true)
    return cb(new Error(`CORS bloqué pour l'origine : ${origin}`))
  },
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

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
