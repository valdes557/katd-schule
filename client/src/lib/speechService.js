// lib/speechService.js — Moteur vocal pour cours IA (Synthèse TTS & Reconnaissance vocale STT)

// Vérifie si la synthèse vocale est supportée par le navigateur
export function isSpeechSynthesisSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

// Vérifie si la reconnaissance vocale (micro) est supportée
export function isSpeechRecognitionSupported() {
  return typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
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

/**
 * Prononce un texte à voix haute avec synchronisation.
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
    try {
      window.speechSynthesis.cancel() // Arrête la lecture précédente si non-enfilée
    } catch (_) {}
  }

  const cleanText = String(text)
    .replace(/[*#_`~>]/g, '') // Nettoie le markdown pour la lecture orale
    .replace(/https?:\/\/\S+/g, '')
    .trim()

  if (!cleanText) return null

  const utterance = new SpeechSynthesisUtterance(cleanText)
  utterance.lang = lang
  utterance.rate = Math.max(0.7, Math.min(1.4, rate))
  utterance.pitch = Math.max(0.5, Math.min(1.5, pitch))
  utterance.volume = Math.max(0, Math.min(1, volume))

  const selectedVoice = getBestVoice(lang, gender)
  if (selectedVoice) {
    utterance.voice = selectedVoice
  }

  if (onStart) utterance.onstart = onStart
  if (onEnd) utterance.onend = onEnd
  if (onError) utterance.onerror = onError

  try {
    window.speechSynthesis.speak(utterance)
  } catch (err) {
    console.warn('[speechService] speak error:', err.message)
    if (onError) onError(err)
  }

  return utterance
}

/**
 * Arrête immédiatement toute lecture vocale.
 */
export function stopSpeaking() {
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
        try {
          recognizer.start()
        } catch (_) {}
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
