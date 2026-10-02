// lib/speechService.js — Moteur vocal pour cours IA (Synthèse TTS & Reconnaissance vocale STT)

// Vérifie si la synthèse vocale est supportée par le navigateur
export function isSpeechSynthesisSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

// Vérifie si la reconnaissance vocale (micro) est supportée
export function isSpeechRecognitionSupported() {
  return typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
}

// Demande explicite de l'autorisation d'accès au micro du navigateur
export async function requestMicrophonePermission() {
  if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      return true
    } catch (err) {
      console.warn('[speechService] permission micro refusée ou non disponible:', err?.message || err)
      return false
    }
  }
  return false
}

let cachedVoices = []
function loadVoices() {
  if (!isSpeechSynthesisSupported()) return []
  const v = window.speechSynthesis.getVoices() || []
  if (v.length > 0) cachedVoices = v
  return cachedVoices
}

if (typeof window !== 'undefined' && isSpeechSynthesisSupported()) {
  loadVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    loadVoices()
  }
}

/**
 * Trouve la meilleure voix disponible pour la langue et le genre demandés.
 * Privilégie les voix "Natural", "Google", "Online" de haute qualité.
 */
export function getBestVoice(lang = 'fr-FR', gender = 'female') {
  const voices = loadVoices()
  if (!voices.length) return null

  const targetLang = (lang || 'fr-FR').toLowerCase().slice(0, 2)
  const langVoices = voices.filter((v) => (v.lang || '').toLowerCase().startsWith(targetLang))
  const pool = langVoices.length > 0 ? langVoices : voices

  const isFemaleName = (name = '') =>
    /female|femme|denise|julie|hortense|celine|claire|amelie|virginie|zira|samantha|karen|victoria/i.test(name)
  const isMaleName = (name = '') =>
    /male|homme|henri|paul|mathieu|claude|nicolas|david|george|guy|daniel/i.test(name)
  const isNatural = (name = '') =>
    /natural|online|google|premium|enhanced|neural/i.test(name)

  if (gender === 'female') {
    const naturalFemale = pool.find((v) => isNatural(v.name) && isFemaleName(v.name))
    if (naturalFemale) return naturalFemale
    const anyFemale = pool.find((v) => isFemaleName(v.name))
    if (anyFemale) return anyFemale
  } else if (gender === 'male') {
    const naturalMale = pool.find((v) => isNatural(v.name) && isMaleName(v.name))
    if (naturalMale) return naturalMale
    const anyMale = pool.find((v) => isMaleName(v.name))
    if (anyMale) return anyMale
  }

  // Voix naturelle par défaut
  const natural = pool.find((v) => isNatural(v.name))
  return natural || pool[0] || null
}

// Ensemble persistant conservant les instances SpeechSynthesisUtterance pour empêcher le Garbage Collector de couper la voix
const activeUtterances = new Set()
if (typeof window !== 'undefined') {
  window.__activeSpeechUtterances = activeUtterances
}

let speechSessionId = 0
let speechKeepAliveTimer = null

function ensureKeepAlive() {
  if (speechKeepAliveTimer) return
  speechKeepAliveTimer = setInterval(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      if (window.speechSynthesis.speaking) {
        try {
          window.speechSynthesis.pause()
          window.speechSynthesis.resume()
        } catch (_) {}
      } else if (activeUtterances.size === 0) {
        clearInterval(speechKeepAliveTimer)
        speechKeepAliveTimer = null
      }
    }
  }, 4000)
}

function stopKeepAlive() {
  if (speechKeepAliveTimer) {
    clearInterval(speechKeepAliveTimer)
    speechKeepAliveTimer = null
  }
}

// Découpe un long texte en segments naturels de phrases (< 180 caractères)
// Contourne le bug universel de Chrome/Android où la synthèse s'arrête brutalement après 14 secondes sur un long bloc
function splitIntoSpeechChunks(text) {
  if (!text) return []
  const rawSegments = text
    .replace(/([.?!;:])\s+/g, '$1|')
    .replace(/\n+/g, '|')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)

  const chunks = []
  for (const seg of rawSegments) {
    if (seg.length <= 180) {
      chunks.push(seg)
    } else {
      const subParts = seg.split(/([,])\s+/).filter(Boolean)
      let current = ''
      for (const part of subParts) {
        if ((current + ' ' + part).length <= 180) {
          current = current ? `${current} ${part}` : part
        } else {
          if (current) chunks.push(current)
          current = part
        }
      }
      if (current) chunks.push(current)
    }
  }
  return chunks.length > 0 ? chunks : [text]
}

/**
 * Prononce un texte à voix haute avec segmentation de phrases, protection contre
 * le garbage-collector et relance automatique pour garantir que l'IA ne s'arrête jamais au milieu.
 */
export function speakText(text, options = {}) {
  if (!isSpeechSynthesisSupported() || !text) return null

  const {
    lang = 'fr-FR',
    gender = 'female',
    rate = 1.0,
    pitch = gender === 'female' ? 1.05 : 0.95,
    volume = 1.0,
    cancelBefore = true,
    enqueue = false,
    onStart,
    onEnd,
    onError,
  } = options

  if (cancelBefore && !enqueue) {
    stopSpeaking()
  }

  const cleanText = String(text)
    .replace(/[*#_`~>]/g, '') // Nettoie le markdown pour la lecture orale
    .replace(/https?:\/\/\S+/g, '')
    .trim()

  if (!cleanText) return null

  const chunks = splitIntoSpeechChunks(cleanText)
  if (chunks.length === 0) return null

  const thisSessionId = ++speechSessionId
  const selectedVoice = getBestVoice(lang, gender)
  let currentIndex = 0
  let started = false

  ensureKeepAlive()

  function speakNextChunk() {
    if (thisSessionId !== speechSessionId) return

    if (currentIndex >= chunks.length) {
      if (onEnd) onEnd()
      return
    }

    const chunkText = chunks[currentIndex]
    currentIndex++

    const utterance = new SpeechSynthesisUtterance(chunkText)
    utterance.lang = lang
    utterance.rate = Math.max(0.7, Math.min(1.3, rate))
    utterance.pitch = Math.max(0.5, Math.min(1.5, pitch))
    utterance.volume = Math.max(0, Math.min(1, volume))
    if (selectedVoice) {
      utterance.voice = selectedVoice
    }

    activeUtterances.add(utterance)

    let watchdogTimer = null
    const clearWatchdog = () => {
      if (watchdogTimer) clearTimeout(watchdogTimer)
      watchdogTimer = null
    }

    utterance.onstart = (evt) => {
      if (!started) {
        started = true
        if (onStart) onStart(evt)
      }
      clearWatchdog()
      watchdogTimer = setTimeout(() => {
        activeUtterances.delete(utterance)
        if (thisSessionId === speechSessionId) {
          try { window.speechSynthesis.resume() } catch (_) {}
          speakNextChunk()
        }
      }, 14000)
    }

    utterance.onend = () => {
      clearWatchdog()
      activeUtterances.delete(utterance)
      if (thisSessionId === speechSessionId) {
        speakNextChunk()
      }
    }

    utterance.onerror = (evt) => {
      clearWatchdog()
      activeUtterances.delete(utterance)
      if (evt?.error === 'canceled' || evt?.error === 'interrupted') return
      console.warn('[speechService] chunk speak warning:', evt?.error || evt)
      if (thisSessionId === speechSessionId) {
        if (currentIndex < chunks.length) {
          speakNextChunk()
        } else if (onError) {
          onError(evt)
        }
      }
    }

    try {
      window.speechSynthesis.speak(utterance)
    } catch (err) {
      clearWatchdog()
      activeUtterances.delete(utterance)
      if (thisSessionId === speechSessionId) {
        if (currentIndex < chunks.length) speakNextChunk()
        else if (onError) onError(err)
      }
    }
  }

  speakNextChunk()
  return true
}

/**
 * Arrête immédiatement toute lecture vocale et réinitialise les files d'attente.
 */
export function stopSpeaking() {
  speechSessionId++
  activeUtterances.clear()
  stopKeepAlive()
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel()
    } catch (_) {}
  }
}

/**
 * Crée une instance de reconnaissance vocale mains libres pour écouter la question de l'élève.
 */
export function createSpeechRecognizer({
  lang = 'fr-FR',
  continuous = true,
  autoRestart = false,
  onResult,
  onError,
  onEnd,
  onStart,
}) {
  if (!isSpeechRecognitionSupported()) {
    return {
      isSupported: false,
      start: () => {},
      stop: () => {},
      pause: () => {},
      resume: () => {},
      isListening: () => false,
    }
  }

  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition
  let recognizer = null
  let running = false
  let manuallyStopped = false

  const initRecognizer = () => {
    recognizer = new SpeechRecognitionClass()
    recognizer.continuous = continuous
    recognizer.interimResults = true
    recognizer.lang = lang

    recognizer.onstart = () => {
      running = true
      if (onStart) onStart()
    }

    recognizer.onresult = (event) => {
      let finalTranscript = ''
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i]
        if (res.isFinal) {
          finalTranscript += res[0].transcript
        } else {
          interimTranscript += res[0].transcript
        }
      }
      if (onResult) {
        onResult({
          final: finalTranscript.trim(),
          interim: interimTranscript.trim(),
          full: (finalTranscript + ' ' + interimTranscript).trim(),
        })
      }
    }

    recognizer.onerror = (e) => {
      // Ignorer les erreurs non bloquantes 'no-speech' et 'aborted'
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('[speechService:mic]', e.error)
      }
      if (onError) onError(e)
    }

    recognizer.onend = () => {
      running = false
      if (onEnd) onEnd()
      // Si autoRestart est activé et qu'on ne l'a pas arrêté manuellement, on relance l'écoute
      if (autoRestart && !manuallyStopped) {
        setTimeout(() => {
          if (!manuallyStopped && !running) {
            try {
              recognizer.start()
            } catch (_) {
              try {
                initRecognizer()
                recognizer.start()
              } catch (__) {}
            }
          }
        }, 200)
      }
    }
  }

  initRecognizer()

  return {
    isSupported: true,
    start: () => {
      manuallyStopped = false
      if (running) return
      try {
        recognizer.start()
      } catch (err) {
        try {
          initRecognizer()
          recognizer.start()
        } catch (err2) {
          console.warn('[speechService] mic start failed:', err2.message)
        }
      }
    },
    stop: () => {
      manuallyStopped = true
      running = false
      try {
        recognizer.stop()
      } catch (_) {}
    },
    pause: () => {
      running = false
      try {
        recognizer.stop()
      } catch (_) {}
    },
    resume: () => {
      manuallyStopped = false
      if (running) return
      try {
        recognizer.start()
      } catch (_) {
        try {
          initRecognizer()
          recognizer.start()
        } catch (_) {}
      }
    },
    isListening: () => running,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gestion de la veille écran (Screen Wake Lock) & Audio en arrière-plan (Lock Screen)
// ─────────────────────────────────────────────────────────────────────────────

let wakeLockSentinel = null
let backgroundAudio = null

// Demande le maintien de l'écran allumé pour les smartphones/tablettes
export async function requestScreenWakeLock() {
  if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen')
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null
      })
      return true
    } catch (err) {
      // Non bloquant si la batterie est faible ou si refusé par l'OS
      console.warn('[speechService] wakeLock request:', err.message)
    }
  }
  return false
}

export async function releaseScreenWakeLock() {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release()
    } catch (_) {}
    wakeLockSentinel = null
  }
}

// Maintient le flux audio actif même lorsque le téléphone se verrouille ou que l'écran s'éteint
export function enableBackgroundAudio({ title = 'Cours en direct IA', teacher = 'Professeur IA', subject = 'KATD-SCHÜLE' } = {}) {
  if (typeof window === 'undefined') return

  // 1. Activer le WakeLock
  requestScreenWakeLock()

  // 2. Initialiser le porteur audio silencieux (requis par iOS et Android pour maintenir SpeechSynthesis actif en veille)
  if (!backgroundAudio) {
    backgroundAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==')
    backgroundAudio.loop = true
    backgroundAudio.volume = 0.05
  }

  try {
    backgroundAudio.play().catch(() => {})
  } catch (_) {}

  // 3. Déclarer la session média au système d'exploitation mobile (Android / iOS / macOS / Windows)
  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && window.MediaMetadata) {
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title,
        artist: teacher ? `Enseigné par ${teacher}` : 'KATD-SCHÜLE IA',
        album: `Cours de ${subject}`,
      })

      navigator.mediaSession.playbackState = 'playing'

      navigator.mediaSession.setActionHandler('play', () => {
        if (backgroundAudio) backgroundAudio.play().catch(() => {})
      })
      navigator.mediaSession.setActionHandler('pause', () => {
        stopSpeaking()
        if (backgroundAudio) backgroundAudio.pause()
      })
    } catch (_) {}
  }
}

// Désactive le porteur audio et relâche le verrouillage
export function disableBackgroundAudio() {
  releaseScreenWakeLock()
  if (backgroundAudio) {
    try {
      backgroundAudio.pause()
    } catch (_) {}
  }
  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'paused'
    } catch (_) {}
  }
}
