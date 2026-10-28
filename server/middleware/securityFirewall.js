// server/middleware/securityFirewall.js — Pare-feu applicatif (WAF) & Protection anti-intrusion KATD-SCHÜLE
const rateLimitMap = new Map()

// Nettoyage régulier du cache de rate-limiting (toutes les 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip)
    }
  }
}, 5 * 60 * 1000)

/**
 * Nettoyage récursif contre les injections NoSQL (supprime les opérateurs $ ou . en début de clé)
 */
function sanitizeNoSql(target) {
  if (!target || typeof target !== 'object') return target
  if (Array.isArray(target)) {
    return target.map(sanitizeNoSql)
  }

  const cleaned = {}
  for (const key of Object.keys(target)) {
    // Si la clé commence par $ (ex: $gt, $ne, $where) ou contient des points d'accès
    if (key.startsWith('$') || key.includes('.')) {
      console.warn(`[SECURITY WARN] Clé NoSQL potentiellement dangereuse ignorée : ${key}`)
      continue
    }
    cleaned[key] = sanitizeNoSql(target[key])
  }
  return cleaned
}

/**
 * Détection des signatures d'attaque connues (SQL Injection, XSS, Path Traversal, Eval injection)
 */
const MALICIOUS_PATTERNS = [
  /(\bunion\s+all\s+select\b|\bunion\s+select\b)/i,
  /(<script\b[^>]*>[\s\S]*?<\/script>)/i,
  /javascript\s*:/i,
  /(\bdrop\s+table\b|\bdrop\s+database\b)/i,
  /(\.\.\/|\.\.\\)/, // Path Traversal
  /\b(exec\s*\(|eval\s*\(|passthru\s*\(|system\s*\()/i,
  /\$where\s*:/i,
]

function checkPayloadForAttacks(str) {
  if (typeof str !== 'string' || !str) return false
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(str)) return true
  }
  return false
}

function scanObjectForAttacks(obj) {
  if (!obj) return false
  if (typeof obj === 'string') return checkPayloadForAttacks(obj)
  if (Array.isArray(obj)) return obj.some(scanObjectForAttacks)
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (checkPayloadForAttacks(key) || scanObjectForAttacks(obj[key])) {
        return true
      }
    }
  }
  return false
}

/**
 * Middleware principal de sécurité
 */
function securityFirewall(req, res, next) {
  // 1. En-têtes HTTP de sécurité stricts (équivalent Helmet renforcé)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.removeHeader('X-Powered-By')

  // 2. Protection contre les attaques par déni de service / brute force
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown-ip'
  const isAuthRoute = req.path.startsWith('/api/auth/login') || req.path.startsWith('/api/auth/register-user')
  const isSensitiveAdmin = req.path.startsWith('/api/admin/co-accounts/verify-otp')

  const now = Date.now()
  let limitRecord = rateLimitMap.get(ip)
  if (!limitRecord || now > limitRecord.resetAt) {
    limitRecord = {
      count: 0,
      authCount: 0,
      resetAt: now + 60 * 1000, // Fenêtre de 1 minute
    }
    rateLimitMap.set(ip, limitRecord)
  }

  limitRecord.count += 1
  if (isAuthRoute || isSensitiveAdmin) {
    limitRecord.authCount += 1
  }

  // Seuil anti-brute force : max 40 requêtes auth par minute par IP
  if (limitRecord.authCount > 40) {
    console.warn(`[SECURITY ALERT] Tentative de brute-force bloquée pour l'IP : ${ip} sur ${req.path}`)
    return res.status(429).json({
      message: 'Trop de tentatives de connexion infructueuses. Veuillez patienter une minute avant de réessayer.',
    })
  }

  // Seuil DDoS global : max 300 requêtes par minute par IP
  if (limitRecord.count > 350) {
    console.warn(`[SECURITY ALERT] Trafic suspect bloqué (DDoS prevention) pour l'IP : ${ip}`)
    return res.status(429).json({
      message: 'Trop de requêtes envoyées. Ralentissez vos actions.',
    })
  }

  // 3. Détection des attaques et sondes malveillantes dans URL et query
  const queryStr = req.url || ''
  if (checkPayloadForAttacks(queryStr)) {
    console.warn(`[SECURITY BLOCKED ATTACK] Tentative d'intrusion URL interceptée depuis l'IP : ${ip} (URL: ${queryStr})`)
    return res.status(403).json({
      message: 'Accès refusé par le pare-feu applicatif de sécurité KATD-SCHÜLE.',
    })
  }

  // 4. Nettoyage NoSQL et filtrage des injections dans le corps de la requête
  if (req.body && typeof req.body === 'object') {
    // Exemption pour les données de fichiers volumineux / base64 déjà vérifiés
    if (!req.path.includes('/uploads') && !req.path.includes('/media')) {
      if (scanObjectForAttacks(req.body)) {
        console.warn(`[SECURITY BLOCKED ATTACK] Payload malveillant bloqué depuis l'IP : ${ip} sur ${req.path}`)
        return res.status(403).json({
          message: 'Contenu interdit ou malveillant détecté par le système de sécurité.',
        })
      }
    }
    req.body = sanitizeNoSql(req.body)
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeNoSql(req.query)
  }

  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeNoSql(req.params)
  }

  next()
}

module.exports = securityFirewall
