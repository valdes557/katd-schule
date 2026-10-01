import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Bot, Loader2, AlertCircle, ArrowLeft, Clock, Radio, CheckCircle2,
  Send, MessageCircle, Sparkles, Volume2, VolumeX, Mic, MicOff,
  Play, Square, BookOpen, Volume1, Edit3, FileText, X, Image as ImageIcon, Maximize2,
} from 'lucide-react'
import { aiCoursesApi } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import {
  isSpeechSynthesisSupported, isSpeechRecognitionSupported,
  speakText, stopSpeaking, createSpeechRecognizer, requestMicrophonePermission,
  enableBackgroundAudio, disableBackgroundAudio, requestScreenWakeLock, releaseScreenWakeLock,
} from '../../lib/speechService'

// Diffusion en direct d'un cours de l'IA enseignante (F2 Secondaire).
// - Avant l'heure : compte à rebours.
// - Pendant : le texte s'écrit progressivement (polling serveur — même position
//   pour tous les spectateurs, calée sur l'horloge serveur).
// - Après : relecture complète + questions des élèves, l'IA répond à chacune.
const POLL_LIVE_MS = 4000 // pendant le cours (le texte avance)
const POLL_IDLE_MS = 15000 // avant le cours / après (questions des autres élèves)

function fmtCountdown(totalSeconds) {
  const s = Math.max(0, totalSeconds)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

export default function AiCourseLivePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isStudent = user?.role === 'eleve'
  const canAsk = ['eleve', 'enseignant', 'directeur', 'super_admin'].includes(user?.role)

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  // Compte à rebours local, recalé sur serverTime à chaque poll
  const [countdown, setCountdown] = useState(null)

  // Édition d'un cours en direct / décompte
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState('')

  // Voix & Audio
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [playingAnswerId, setPlayingAnswerId] = useState(null)
  const [readingFullCourse, setReadingFullCourse] = useState(false)

  // Reconnaissance vocale mains libres (Élève ou Professeur en test pose sa question vocalement)
  const [handsFreeActive, setHandsFreeActive] = useState(false)
  const [speechDetected, setSpeechDetected] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const recognizerRef = useRef(null)
  const handsFreeActiveRef = useRef(false)
  const askingRef = useRef(false)
  const isSpeakingRef = useRef(false)
  const lastFullTextRef = useRef('')
  const silenceTimerRef = useRef(null)

  // Synchronisation vocale du cours en direct
  const spokenUnitsCountRef = useRef(0)
  const speechQueueRef = useRef([])
  const isQueueRunningRef = useRef(false)
  const courseEndAnnouncedRef = useRef(false)

  // Compte à rebours de la session Q&R (après la fin du cours)
  const [qaCountdown, setQaCountdown] = useState(null)
  const [zoomedImage, setZoomedImage] = useState(null)

  const bottomRef = useRef(null)
  const prevLenRef = useRef(0)
  const autoScrollRef = useRef(true) // désactivé si l'utilisateur remonte lire

  const fetchLive = useCallback(async () => {
    try {
      const res = await aiCoursesApi.live(id)
      setData(res.data)
      setError('')
      setCountdown(res.data.secondsToStart)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [id])

  // Polling : rapide pendant le direct, lent sinon
  useEffect(() => {
    fetchLive()
  }, [fetchLive])
  useEffect(() => {
    if (!data) return
    const ms = data.status === 'en_cours' ? POLL_LIVE_MS : POLL_IDLE_MS
    if (['annule', 'erreur'].includes(data.status)) return
    const t = setInterval(fetchLive, ms)
    return () => clearInterval(t)
  }, [data?.status, fetchLive]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tic-tac local du compte à rebours entre deux polls
  useEffect(() => {
    if (countdown === null || countdown <= 0 || data?.status !== 'pret' && data?.status !== 'planifie' && data?.status !== 'generation') return
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [countdown !== null, data?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Le compte à rebours atteint 0 → re-poll immédiat (le cours démarre)
  useEffect(() => {
    if (countdown === 0 && ['pret', 'planifie', 'generation'].includes(data?.status)) fetchLive()
  }, [countdown === 0]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll quand du texte s'ajoute (sauf si l'utilisateur est remonté lire)
  useEffect(() => {
    const len = data?.text?.length || 0
    if (data?.status === 'en_cours' && len > prevLenRef.current && autoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
    prevLenRef.current = len
  }, [data?.text, data?.status])

  useEffect(() => {
    const onScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 200
      autoScrollRef.current = nearBottom
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Nettoyage audio et micro au démontage du composant
  useEffect(() => {
    return () => {
      stopSpeaking()
      disableBackgroundAudio()
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      recognizerRef.current?.stop()
    }
  }, [])

  // Maintient le flux audio et le WakeLock actifs même écran verrouillé
  useEffect(() => {
    if (voiceEnabled && (data?.status === 'en_cours' || isSpeaking || readingFullCourse)) {
      enableBackgroundAudio({
        title: data?.title || 'Cours IA en direct',
        teacher: data?.teacherName || "L'IA enseignante",
        subject: data?.subject || 'KATD-SCHÜLE',
      })
    } else if (!isSpeaking && !readingFullCourse && data?.status !== 'en_cours') {
      disableBackgroundAudio()
    }
  }, [voiceEnabled, data?.status, data?.title, data?.teacherName, data?.subject, isSpeaking, readingFullCourse])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && voiceEnabled && (data?.status === 'en_cours' || isSpeaking || readingFullCourse)) {
        requestScreenWakeLock()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [voiceEnabled, data?.status, isSpeaking, readingFullCourse])

  // Queue vocale : diffuse chaque paragraphe successivement
  const processSpeechQueue = useCallback(() => {
    if (!voiceEnabled || isQueueRunningRef.current || speechQueueRef.current.length === 0) {
      return
    }
    const nextText = speechQueueRef.current.shift()
    if (!nextText) return

    isQueueRunningRef.current = true
    isSpeakingRef.current = true
    setIsSpeaking(true)

    speakText(nextText, {
      lang: data?.language || 'fr-FR',
      gender: data?.voice || 'female',
      cancelBefore: false,
      enqueue: true,
      onStart: () => {
        isSpeakingRef.current = true
        setIsSpeaking(true)
      },
      onEnd: () => {
        isQueueRunningRef.current = false
        if (speechQueueRef.current.length > 0) {
          processSpeechQueue()
        } else {
          isSpeakingRef.current = false
          setIsSpeaking(false)
        }
      },
      onError: () => {
        isQueueRunningRef.current = false
        if (speechQueueRef.current.length > 0) {
          processSpeechQueue()
        } else {
          isSpeakingRef.current = false
          setIsSpeaking(false)
        }
      },
    })
  }, [voiceEnabled, data?.language, data?.voice])

  // Synchronisation vocale automatique pendant le cours en direct
  useEffect(() => {
    if (!voiceEnabled || data?.status !== 'en_cours') return
    const units = data?.units || []
    if (units.length > spokenUnitsCountRef.current) {
      const newUnits = units.slice(spokenUnitsCountRef.current)
      spokenUnitsCountRef.current = units.length
      speechQueueRef.current.push(...newUnits)
      processSpeechQueue()
    }
  }, [data?.units, data?.status, voiceEnabled, processSpeechQueue])

  // Démarre l'écoute mains libres (l'élève ou enseignant parle depuis sa table sans toucher au micro)
  const startHandsFreeListening = useCallback(async () => {
    if (!isSpeechRecognitionSupported()) return
    await requestMicrophonePermission()
    handsFreeActiveRef.current = true
    setHandsFreeActive(true)

    if (recognizerRef.current) {
      try { recognizerRef.current.stop() } catch (_) {}
    }

    const recognizer = createSpeechRecognizer({
      lang: data?.language || 'fr-FR',
      continuous: true,
      autoRestart: true,
      onStart: () => {
        setIsListening(true)
      },
      onResult: ({ final, full, interim }) => {
        const text = (full || final || interim || '').trim()
        if (!text) return
        if (askingRef.current || isSpeakingRef.current) return

        lastFullTextRef.current = text
        setVoiceTranscript(text)
        setQuestion(text)
        setSpeechDetected(true)

        // Détection de fin de phrase : 1.3 seconde de silence après que la personne a parlé
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = setTimeout(() => {
          const candidate = (lastFullTextRef.current || '').trim()
          if (candidate.length >= 4 && !askingRef.current && !isSpeakingRef.current) {
            recognizerRef.current?.pause()
            setSpeechDetected(false)
            handleAsk(null, candidate)
          }
        }, 1300)
      },
      onError: (err) => {
        if (err.error !== 'no-speech' && err.error !== 'aborted') {
          console.warn('[HandsFree:mic]', err.error)
        }
      },
      onEnd: () => {
        if (!handsFreeActiveRef.current) {
          setIsListening(false)
        }
      },
    })

    recognizerRef.current = recognizer
    recognizer.start()
  }, [data?.language]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopHandsFreeListening = useCallback(() => {
    handsFreeActiveRef.current = false
    setHandsFreeActive(false)
    setIsListening(false)
    setSpeechDetected(false)
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (recognizerRef.current) {
      try { recognizerRef.current.stop() } catch (_) {}
    }
  }, [])

  const handleToggleHandsFree = () => {
    if (handsFreeActive) {
      stopHandsFreeListening()
    } else {
      if (!isSpeechRecognitionSupported()) {
        alert('La reconnaissance vocale nécessite Google Chrome, Microsoft Edge ou Safari.')
        return
      }
      startHandsFreeListening()
    }
  }

  const handleCancelDetectedSpeech = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    lastFullTextRef.current = ''
    setVoiceTranscript('')
    setQuestion('')
    setSpeechDetected(false)
  }

  const canEdit = ['enseignant', 'directeur', 'super_admin'].includes(user?.role) && ['planifie', 'generation', 'pret', 'en_cours'].includes(data?.status)

  const openEditModal = async () => {
    try {
      setEditError('')
      const res = await aiCoursesApi.get(id)
      const c = res.data
      const pad = (n) => String(n).padStart(2, '0')
      const formatDt = (dt) => {
        if (!dt) return ''
        const d = new Date(dt)
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      }
      setEditForm({
        title: c.title || '',
        subject: c.subject || '',
        scheduledAt: formatDt(c.scheduledAt),
        durationMinutes: c.durationMinutes || 45,
        qaDurationMinutes: c.qaDurationMinutes ?? 10,
        language: c.language || 'fr-FR',
        voice: c.voice || 'female',
        sourceType: c.sourceType || 'text',
        sourceText: c.sourceText || '',
        pdf: null,
        nextCourseTitle: c.nextCourseTitle || '',
        nextCourseDate: formatDt(c.nextCourseDate),
        nextCourseInstructions: c.nextCourseInstructions || '',
        nextCourseSourceType: c.nextCourseSourceType || 'none',
        nextCourseSourceText: c.nextCourseSourceText || '',
        nextPdf: null,
      })
      setShowEditModal(true)
    } catch (err) {
      alert("Impossible d'ouvrir l'édition du cours : " + err.message)
    }
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    setEditSaving(true)
    setEditError('')
    try {
      const payload = {
        ...editForm,
        scheduledAt: new Date(editForm.scheduledAt).toISOString(),
        nextCourseDate: editForm.nextCourseDate ? new Date(editForm.nextCourseDate).toISOString() : undefined,
      }
      await aiCoursesApi.update(id, payload)
      setShowEditModal(false)
      await fetchLive()
    } catch (err) {
      setEditError(err.message)
    }
    setEditSaving(false)
  }

  // Annonce vocale de fin de cours & ouverture automatique du mode mains libres
  useEffect(() => {
    if (data?.status === 'termine' && !courseEndAnnouncedRef.current) {
      courseEndAnnouncedRef.current = true
      if (voiceEnabled) {
        const qaMins = data.qaDurationMinutes ?? 10
        const endAnnouncement = data.language === 'en-US'
          ? `The lesson has finished. Hands-free question mode is now active. Students, you may ask your questions directly from your desk aloud without touching any button. I am listening and will answer you.`
          : `Le cours est maintenant terminé. Le mode questions mains libres est activé. Chers élèves, posez directement vos questions depuis votre table à voix haute sans appuyer sur aucun bouton, je vous écoute et je vous réponds.`
        setTimeout(() => {
          isSpeakingRef.current = true
          setIsSpeaking(true)
          speakText(endAnnouncement, {
            lang: data.language || 'fr-FR',
            gender: data.voice || 'female',
            onStart: () => {
              isSpeakingRef.current = true
              setIsSpeaking(true)
            },
            onEnd: () => {
              isSpeakingRef.current = false
              setIsSpeaking(false)
              if (canAsk && isSpeechRecognitionSupported()) {
                startHandsFreeListening()
              }
            },
            onError: () => {
              isSpeakingRef.current = false
              setIsSpeaking(false)
              if (canAsk && isSpeechRecognitionSupported()) {
                startHandsFreeListening()
              }
            },
          })
        }, 1000)
      } else if (canAsk && isSpeechRecognitionSupported()) {
        startHandsFreeListening()
      }
    }
  }, [data?.status, data?.language, data?.voice, data?.qaDurationMinutes, voiceEnabled, canAsk, startHandsFreeListening])

  // Décompte de la session Q&R
  useEffect(() => {
    if (data?.status !== 'termine' || !data?.endedAt) return
    const totalQaSec = (data.qaDurationMinutes ?? 10) * 60
    const updateQaTimer = () => {
      const elapsedSec = Math.floor((Date.now() - new Date(data.endedAt).getTime()) / 1000)
      setQaCountdown(Math.max(0, totalQaSec - elapsedSec))
    }
    updateQaTimer()
    const timer = setInterval(updateQaTimer, 1000)
    return () => clearInterval(timer)
  }, [data?.status, data?.endedAt, data?.qaDurationMinutes])

  const toggleVoice = () => {
    if (voiceEnabled) {
      stopSpeaking()
      disableBackgroundAudio()
      speechQueueRef.current = []
      isQueueRunningRef.current = false
      isSpeakingRef.current = false
      setIsSpeaking(false)
      setPlayingAnswerId(null)
      setReadingFullCourse(false)
      setVoiceEnabled(false)
    } else {
      setVoiceEnabled(true)
      enableBackgroundAudio({
        title: data?.title || 'Cours IA en direct',
        teacher: data?.teacherName || "L'IA enseignante",
        subject: data?.subject || 'KATD-SCHÜLE',
      })
      if (data?.status === 'en_cours' && data?.units?.length > 0) {
        const units = data.units
        spokenUnitsCountRef.current = units.length
        speechQueueRef.current = [units[units.length - 1]]
        setTimeout(processSpeechQueue, 60)
      }
    }
  }

  // Soumission de question (texte ou vocale mains libres) et réponse vocale immédiate de l'IA
  const handleAsk = async (e, customText) => {
    if (e) e.preventDefault()
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    const q = (customText || question || lastFullTextRef.current).trim()
    if (!q) return

    askingRef.current = true
    setAsking(true)
    setAskError('')
    setSpeechDetected(false)

    // Met en pause le micro pendant que l'IA analyse et formule sa réponse
    if (recognizerRef.current) {
      recognizerRef.current.pause()
    }

    try {
      const res = await aiCoursesApi.askQuestion(id, q)
      setQuestion('')
      setVoiceTranscript('')
      lastFullTextRef.current = ''
      await fetchLive()

      // L'IA répond vocalement à l'élève à voix haute
      const answer = res?.data?.question?.answer
      if (answer && voiceEnabled) {
        isSpeakingRef.current = true
        setIsSpeaking(true)
        speakText(answer, {
          lang: data?.language || 'fr-FR',
          gender: data?.voice || 'female',
          onStart: () => {
            isSpeakingRef.current = true
            setIsSpeaking(true)
          },
          onEnd: () => {
            isSpeakingRef.current = false
            setIsSpeaking(false)
            askingRef.current = false
            setAsking(false)
            // L'IA a fini de parler : on rouvre automatiquement le micro pour la question suivante !
            if (handsFreeActiveRef.current && recognizerRef.current) {
              recognizerRef.current.resume()
            }
          },
          onError: () => {
            isSpeakingRef.current = false
            setIsSpeaking(false)
            askingRef.current = false
            setAsking(false)
            if (handsFreeActiveRef.current && recognizerRef.current) {
              recognizerRef.current.resume()
            }
          },
        })
      } else {
        askingRef.current = false
        setAsking(false)
        if (handsFreeActiveRef.current && recognizerRef.current) {
          recognizerRef.current.resume()
        }
      }

      // Descend vers la réponse fraîchement ajoutée
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 300)
    } catch (e2) {
      setAskError(e2.message)
      askingRef.current = false
      setAsking(false)
      if (handsFreeActiveRef.current && recognizerRef.current) {
        recognizerRef.current.resume()
      }
    }
  }

  const handlePlayAnswer = (q) => {
    if (playingAnswerId === q._id) {
      stopSpeaking()
      setPlayingAnswerId(null)
      isSpeakingRef.current = false
      setIsSpeaking(false)
      if (handsFreeActiveRef.current && recognizerRef.current) {
        recognizerRef.current.resume()
      }
      return
    }
    stopSpeaking()
    if (recognizerRef.current) {
      recognizerRef.current.pause()
    }
    setPlayingAnswerId(q._id)
    isSpeakingRef.current = true
    setIsSpeaking(true)
    speakText(q.answer, {
      lang: data?.language || 'fr-FR',
      gender: data?.voice || 'female',
      onStart: () => {
        setPlayingAnswerId(q._id)
        isSpeakingRef.current = true
        setIsSpeaking(true)
      },
      onEnd: () => {
        setPlayingAnswerId(null)
        isSpeakingRef.current = false
        setIsSpeaking(false)
        if (handsFreeActiveRef.current && recognizerRef.current) {
          recognizerRef.current.resume()
        }
      },
      onError: () => {
        setPlayingAnswerId(null)
        isSpeakingRef.current = false
        setIsSpeaking(false)
        if (handsFreeActiveRef.current && recognizerRef.current) {
          recognizerRef.current.resume()
        }
      },
    })
  }

  const handlePlayFullCourse = () => {
    if (readingFullCourse) {
      stopSpeaking()
      setReadingFullCourse(false)
      isSpeakingRef.current = false
      setIsSpeaking(false)
      if (handsFreeActiveRef.current && recognizerRef.current) {
        recognizerRef.current.resume()
      }
      return
    }
    stopSpeaking()
    if (recognizerRef.current) {
      recognizerRef.current.pause()
    }
    setReadingFullCourse(true)
    isSpeakingRef.current = true
    setIsSpeaking(true)
    speakText(data?.text || '', {
      lang: data?.language || 'fr-FR',
      gender: data?.voice || 'female',
      onStart: () => {
        setReadingFullCourse(true)
        isSpeakingRef.current = true
        setIsSpeaking(true)
      },
      onEnd: () => {
        setReadingFullCourse(false)
        isSpeakingRef.current = false
        setIsSpeaking(false)
        if (handsFreeActiveRef.current && recognizerRef.current) {
          recognizerRef.current.resume()
        }
      },
      onError: () => {
        setReadingFullCourse(false)
        isSpeakingRef.current = false
        setIsSpeaking(false)
        if (handsFreeActiveRef.current && recognizerRef.current) {
          recognizerRef.current.resume()
        }
      },
    })
  }

  const handlePlayNextCourse = () => {
    const text = data?.language === 'en-US'
      ? `For our next class titled ${data.nextCourseTitle || 'Next Session'} : ${data.nextCourseInstructions || ''}`
      : `Pour notre prochain cours intitulé ${data.nextCourseTitle || 'Séance suivante'} : ${data.nextCourseInstructions || ''}`
    if (recognizerRef.current) {
      recognizerRef.current.pause()
    }
    isSpeakingRef.current = true
    setIsSpeaking(true)
    speakText(text, {
      lang: data?.language || 'fr-FR',
      gender: data?.voice || 'female',
      onStart: () => {
        isSpeakingRef.current = true
        setIsSpeaking(true)
      },
      onEnd: () => {
        isSpeakingRef.current = false
        setIsSpeaking(false)
        if (handsFreeActiveRef.current && recognizerRef.current) {
          recognizerRef.current.resume()
        }
      },
      onError: () => {
        isSpeakingRef.current = false
        setIsSpeaking(false)
        if (handsFreeActiveRef.current && recognizerRef.current) {
          recognizerRef.current.resume()
        }
      },
    })
  }

  const renderChalkboardContent = (rawText) => {
    if (!rawText) return null
    const imageRegex = /!\[(.*?)\]\((.*?)\)/g
    const elements = []
    let lastIndex = 0
    let match

    while ((match = imageRegex.exec(rawText)) !== null) {
      if (match.index > lastIndex) {
        elements.push({
          type: 'text',
          content: rawText.substring(lastIndex, match.index),
        })
      }
      elements.push({
        type: 'image',
        alt: match[1] || 'Illustration du cours',
        src: match[2],
      })
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < rawText.length) {
      elements.push({
        type: 'text',
        content: rawText.substring(lastIndex),
      })
    }

    return elements.map((item, idx) => {
      if (item.type === 'text') {
        return <span key={idx} className="whitespace-pre-wrap">{item.content}</span>
      }
      return (
        <div key={idx} className="my-4 p-3 bg-purple-50/50 rounded-2xl border border-purple-200/80 shadow-xs">
          <div
            className="relative group cursor-pointer overflow-hidden rounded-xl bg-white border border-purple-100 flex items-center justify-center max-h-96"
            onClick={() => setZoomedImage({ url: item.src, caption: item.alt })}
          >
            <img
              src={item.src}
              alt={item.alt}
              className="max-h-80 w-auto object-contain rounded-xl transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5 backdrop-blur-[1px]">
              <Maximize2 size={16} /> Cliquer pour agrandir
            </div>
          </div>
          {item.alt && (
            <p className="text-center text-xs font-medium text-purple-900 mt-2 italic">
              📷 {item.alt}
            </p>
          )}
        </div>
      )
    })
  }

  if (loading) return <div className="text-center py-20"><Loader2 size={26} className="animate-spin mx-auto text-purple-600" /></div>
  if (error) {
    return (
      <div className="text-center py-20 text-gray-500">
        <AlertCircle size={36} className="mx-auto mb-3 text-red-400" />
        <p className="text-sm">{error}</p>
        <button onClick={() => navigate('/dashboard/ia-cours')} className="btn-ghost border border-gray-200 text-sm mt-4"><ArrowLeft size={14} /> Retour aux cours</button>
      </div>
    )
  }
  if (!data) return null

  const isLive = data.status === 'en_cours'
  const isDone = data.status === 'termine'
  const isWaiting = ['planifie', 'generation', 'pret'].includes(data.status)
  const myQuestions = (data.questions || []).filter((q) => q.studentName) // toutes affichées, le nom identifie

  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-fade-in pb-24">
      {/* Bandeau */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard/ia-cours')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900 truncate">{data.title}</h1>
            {isLive && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 animate-pulse">
                <Radio size={11} /> EN DIRECT
              </span>
            )}
            {isDone && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
                <CheckCircle2 size={11} /> Terminé
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {data.subject} · {data.className} · {data.teacherName && `Préparé par ${data.teacherName} · `}{data.durationMinutes} min
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openEditModal}
            className="btn-ghost border border-purple-200 text-purple-700 hover:bg-purple-50 text-xs py-1.5 px-3 rounded-xl flex items-center gap-1.5 shrink-0 shadow-xs"
          >
            <Edit3 size={13} /> Modifier ce cours
          </button>
        )}
        {isLive && data.remainingSeconds != null && (
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase text-gray-400 font-semibold">Temps restant</p>
            <p className="text-sm font-bold text-gray-800 tabular-nums flex items-center gap-1 justify-end"><Clock size={13} /> {fmtCountdown(data.remainingSeconds)}</p>
          </div>
        )}
      </div>

      {/* Barre de contrôle vocal & audio */}
      {(isLive || isDone) && (
        <div className="bg-white border border-gray-200/90 rounded-2xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={toggleVoice}
              className={`text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 transition-all shadow-sm ${
                voiceEnabled
                  ? 'bg-purple-600 text-white shadow-purple-200 hover:bg-purple-700'
                  : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {voiceEnabled ? 'Voix de l\'IA active' : 'Activer la voix de l\'IA'}
            </button>

            {isSpeaking && (
              <span className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2.5 py-1 flex items-center gap-1.5 animate-pulse">
                <Volume1 size={13} className="text-purple-600 animate-bounce" />
                L'IA dispense le cours oralement...
              </span>
            )}

            <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
              {data.voice === 'male' ? '👨 Voix homme' : '👩 Voix femme'} ({data.language === 'en-US' ? 'Anglais' : 'Français'})
            </span>

            <span className="text-[11px] text-purple-700 bg-purple-50/90 border border-purple-200 rounded-full px-2.5 py-1 flex items-center gap-1 font-medium">
              📱 Écran de veille & audio actif
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isDone && (
              <button
                onClick={handlePlayFullCourse}
                className="text-xs btn-ghost border border-gray-200 flex items-center gap-1.5 py-1.5 px-3"
              >
                {readingFullCourse ? <Square size={13} className="text-red-500" /> : <Play size={13} className="text-purple-600" />}
                {readingFullCourse ? 'Arrêter la lecture' : 'Réécouter tout le cours'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Barre de progression du cours */}
      {(isLive || isDone) && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-purple-500 rounded-full transition-all duration-1000" style={{ width: `${Math.round((isDone ? 1 : data.progress) * 100)}%` }} />
        </div>
      )}

      {/* Avant le cours : compte à rebours */}
      {isWaiting && (
        <div className="card p-10 text-center">
          <Bot size={40} className="mx-auto text-purple-500 mb-4" />
          {data.status === 'generation' ? (
            <p className="text-sm text-purple-700 flex items-center justify-center gap-2"><Sparkles size={15} className="animate-pulse" /> L'IA enseignante prépare la leçon...</p>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-2">Le cours commence dans</p>
              <p className="text-4xl font-bold text-gray-900 tabular-nums">{fmtCountdown(countdown ?? data.secondsToStart)}</p>
            </>
          )}
          <p className="text-xs text-gray-400 mt-4">
            {new Date(data.scheduledAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' à '}
            {new Date(data.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-purple-700 bg-purple-50 border border-purple-100 rounded-full py-1 px-3 w-fit mx-auto">
            <Volume2 size={13} /> L'IA dispensera ce cours avec sa voix naturelle ({data.voice === 'male' ? 'masculine' : 'féminine'}, {data.language === 'en-US' ? 'anglais' : 'français'})
          </div>
          {canEdit && (
            <div className="mt-4 pt-4 border-t border-purple-100 flex justify-center">
              <button
                type="button"
                onClick={openEditModal}
                className="btn-primary text-xs py-2 px-4 shadow-sm flex items-center gap-1.5"
              >
                <Edit3 size={13} /> Modifier ce cours (corriger une erreur)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Statuts d'échec */}
      {data.status === 'annule' && (
        <div className="card p-10 text-center text-gray-500"><AlertCircle size={32} className="mx-auto mb-3 text-amber-400" /><p className="text-sm">Ce cours a été annulé.</p></div>
      )}
      {data.status === 'erreur' && (
        <div className="card p-10 text-center text-gray-500"><AlertCircle size={32} className="mx-auto mb-3 text-red-400" /><p className="text-sm">Ce cours n'a pas pu être diffusé.</p>{data.generationError && <p className="text-xs text-gray-400 mt-1">{data.generationError}</p>}</div>
      )}

      {/* Galerie des figures et illustrations pédagogiques associées */}
      {(isLive || isDone) && data.images && data.images.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50/80 via-orange-50/50 to-amber-50/80 border border-amber-200/90 rounded-2xl p-4 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
              <ImageIcon size={16} className="text-amber-700" />
              Figures, Schémas & Supports visuels du cours ({data.images.length})
            </span>
            <span className="text-[11px] text-amber-800 font-medium">
              L'IA commente ces figures à l'oral
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {data.images.map((img, idx) => (
              <div
                key={idx}
                onClick={() => setZoomedImage({ url: img.url, caption: img.caption || img.name || `Figure ${idx + 1}` })}
                className="group relative bg-white border border-amber-200/90 rounded-xl overflow-hidden cursor-pointer shadow-xs hover:shadow-md transition-all"
              >
                <div className="h-28 w-full bg-amber-100/40 flex items-center justify-center overflow-hidden">
                  <img
                    src={img.url}
                    alt={img.name || `Figure ${idx + 1}`}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-2 bg-white">
                  <p className="text-xs font-bold text-gray-800 truncate">
                    Figure {idx + 1} : {img.name || 'Illustration'}
                  </p>
                  {img.caption && (
                    <p className="text-[10px] text-gray-500 truncate">{img.caption}</p>
                  )}
                </div>
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1 backdrop-blur-[1px]">
                  <Maximize2 size={14} /> Agrandir
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Le tableau : texte du cours qui s'écrit */}
      {(isLive || isDone) && (
        <div className="card p-5 sm:p-8 bg-white relative">
          {data.usedFallback && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 mb-4">Cours diffusé à partir du contenu du professeur.</p>
          )}
          <div className="prose-sm max-w-none text-[15px] leading-7 text-gray-800">
            {renderChalkboardContent(data.text)}
            {isLive && <span className="inline-block w-0.5 h-4 bg-purple-500 ml-0.5 align-middle animate-pulse" />}
          </div>
          {isLive && !data.text && (
            <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Le cours démarre...</p>
          )}
        </div>
      )}

      {/* Annonce du prochain cours & devoirs (si renseigné par l'enseignant) */}
      {isDone && (data.nextCourseTitle || data.nextCourseInstructions || data.nextCourseDate || data.nextCourseSourceText || data.nextCoursePdfUrl) && (
        <div className="card p-5 bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-purple-50/40 border border-blue-200/90 rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <BookOpen size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-blue-950">Prochain cours & Devoirs à préparer</h3>
                <p className="text-[11px] text-blue-700/80">Programmé par l'enseignant pour la suite du programme</p>
              </div>
            </div>
            {isSpeechSynthesisSupported() && (
              <button
                type="button"
                onClick={handlePlayNextCourse}
                className="text-xs px-2.5 py-1 rounded-full border border-blue-300 bg-white text-blue-700 hover:bg-blue-50 flex items-center gap-1.5 shadow-sm font-medium transition-all"
              >
                <Volume2 size={12} /> Écouter les consignes
              </button>
            )}
          </div>
          {data.nextCourseTitle && (
            <div className="text-sm font-bold text-gray-900">
              Sujet : <span className="text-blue-700">{data.nextCourseTitle}</span>
            </div>
          )}
          {data.nextCourseDate && (
            <div className="text-xs text-gray-600 flex items-center gap-1.5">
              <Clock size={13} className="text-blue-600" />
              Séance prévue le : <strong>{new Date(data.nextCourseDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {new Date(data.nextCourseDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong>
            </div>
          )}
          {data.nextCourseInstructions && (
            <div className="bg-white/90 rounded-xl p-3 border border-blue-100 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed shadow-xs">
              <span className="font-semibold text-blue-900 block mb-1">Consignes et exercices :</span>
              {data.nextCourseInstructions}
            </div>
          )}
          {data.nextCourseSourceText && (
            <div className="bg-white/95 rounded-xl p-3 border border-blue-100 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed shadow-xs">
              <span className="font-semibold text-blue-900 block mb-1">Contenu préparatoire du prochain cours :</span>
              {data.nextCourseSourceText}
            </div>
          )}
          {data.nextCoursePdfUrl && (
            <div className="bg-white/95 rounded-xl p-3 border border-blue-100 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs text-gray-800 truncate">
                <FileText size={16} className="text-red-500 shrink-0" />
                <span className="font-medium truncate">{data.nextCoursePdfName || 'Support PDF du prochain cours'}</span>
              </div>
              <a
                href={data.nextCoursePdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-xs border border-blue-200 text-blue-700 hover:bg-blue-50 py-1 px-2.5 rounded-lg shrink-0 flex items-center gap-1 font-medium"
              >
                Consulter / Télécharger
              </a>
            </div>
          )}
        </div>
      )}

      {/* Fin du cours : questions & réponses */}
      {isDone && (
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <MessageCircle size={16} className="text-purple-600" /> Questions des élèves
            </h2>
            {qaCountdown !== null && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                qaCountdown > 0 ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' : 'bg-gray-100 text-gray-500 border-gray-200'
              }`}>
                <Clock size={12} />
                {qaCountdown > 0 ? `Temps questions restant : ${fmtCountdown(qaCountdown)}` : 'Session de questions terminée'}
              </span>
            )}
          </div>

          {myQuestions.length === 0 && (
            <p className="text-xs text-gray-400">Aucune question pour l'instant.{canAsk ? ' Posez votre question au micro depuis votre table ou écrivez-la !' : ''}</p>
          )}

          {myQuestions.map((q) => (
            <div key={q._id} className="space-y-2">
              <div className="flex justify-end">
                <div className="bg-purple-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[85%] shadow-sm">
                  <p className="text-[10px] opacity-70 font-semibold">{q.studentName}</p>
                  <p className="text-sm">{q.question}</p>
                </div>
              </div>
              {q.answer && (
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={14} className="text-purple-600" />
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%] shadow-xs space-y-1.5">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{q.answer}</p>
                    {isSpeechSynthesisSupported() && (
                      <button
                        onClick={() => handlePlayAnswer(q)}
                        className={`text-[11px] px-2 py-0.5 rounded-full border flex items-center gap-1 font-medium transition-all ${
                          playingAnswerId === q._id
                            ? 'bg-purple-600 text-white border-purple-600 animate-pulse'
                            : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
                        }`}
                      >
                        {playingAnswerId === q._id ? <VolumeX size={11} /> : <Volume2 size={11} />}
                        {playingAnswerId === q._id ? 'Arrêter' : 'Écouter la réponse'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {canAsk && (
            <div className="sticky bottom-4 space-y-2.5">
              {/* Bandeau d'état du Mode Mains Libres */}
              {handsFreeActive ? (
                <div className={`rounded-2xl p-3 border shadow-md transition-all ${
                  asking
                    ? 'bg-purple-950 text-white border-purple-800 animate-pulse'
                    : isSpeaking
                    ? 'bg-indigo-950 text-white border-indigo-800'
                    : speechDetected
                    ? 'bg-amber-950 text-white border-amber-800 ring-2 ring-amber-500/50'
                    : 'bg-emerald-950/95 text-white border-emerald-800'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="relative flex h-3 w-3 shrink-0">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          asking ? 'bg-purple-400' : isSpeaking ? 'bg-indigo-400' : speechDetected ? 'bg-amber-400' : 'bg-emerald-400'
                        }`} />
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${
                          asking ? 'bg-purple-500' : isSpeaking ? 'bg-indigo-500' : speechDetected ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">
                          {asking
                            ? "🧠 L'IA analyse votre question..."
                            : isSpeaking
                            ? "🗣️ L'IA vous répond oralement..."
                            : speechDetected
                            ? "🎙️ Voix détectée ! Envoi automatique à l'IA..."
                            : "🟢 Mains Libres ACTIF : Parlez simplement depuis votre table !"}
                        </p>
                        {speechDetected && voiceTranscript && (
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[11px] text-amber-200 italic truncate max-w-xs sm:max-w-md">
                              « {voiceTranscript} »
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {speechDetected && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const q = (voiceTranscript || lastFullTextRef.current || '').trim()
                              if (q.length >= 4) {
                                recognizerRef.current?.pause()
                                setSpeechDetected(false)
                                handleAsk(null, q)
                              }
                            }}
                            className="text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded-md transition-colors shadow-xs flex items-center gap-1"
                          >
                            <Send size={11} /> Envoyer
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelDetectedSpeech}
                            className="text-[11px] bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-md transition-colors"
                          >
                            Annuler
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={handleToggleHandsFree}
                        className="text-[11px] bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-md font-semibold transition-colors"
                      >
                        Suspendre
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Mic size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-purple-950">Mode Questions Mains Libres</p>
                      <p className="text-[11px] text-purple-700/80 truncate">Posez vos questions depuis votre table sans toucher au micro : l'IA répond vocalement.</p>
                    </div>
                  </div>
                  {isSpeechRecognitionSupported() && (
                    <button
                      type="button"
                      onClick={handleToggleHandsFree}
                      className="btn-primary text-xs py-1.5 px-3 shrink-0 flex items-center gap-1.5 shadow-sm font-semibold"
                    >
                      <Mic size={13} /> Activer Mains Libres
                    </button>
                  )}
                </div>
              )}

              {/* Formulaire de saisie (mains libres ou écrit) */}
              <form onSubmit={(e) => handleAsk(e)} className="bg-white border border-gray-200 rounded-2xl shadow-card p-2 flex items-end gap-2">
                {isSpeechRecognitionSupported() && (
                  <button
                    type="button"
                    onClick={handleToggleHandsFree}
                    title={handsFreeActive ? "Mode mains libres actif (cliquer pour suspendre)" : "Activer le mode mains libres"}
                    className={`p-2.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold ${
                      handsFreeActive
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    {handsFreeActive ? <Mic size={16} /> : <MicOff size={16} />}
                    <span className="hidden sm:inline">{handsFreeActive ? 'Mains libres ON' : 'Mains libres OFF'}</span>
                  </button>
                )}
                <textarea
                  rows={1}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(e) } }}
                  placeholder={handsFreeActive ? "Parlez depuis votre table, l'IA détecte et répond..." : "Posez votre question (ou activez le mode mains libres)..."}
                  maxLength={500}
                  className="flex-1 resize-none text-sm px-3 py-2 outline-none bg-transparent"
                />
                <button type="submit" disabled={asking || !question.trim()} className="btn-primary p-2.5 rounded-xl disabled:opacity-50">
                  {asking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </form>
            </div>
          )}
          {askError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{askError}</p>}
          {canAsk && (
            <p className="text-[10px] text-gray-400 text-center">
              {handsFreeActive
                ? "🎙️ Mode mains libres actif : parlez depuis votre table, l'IA détecte la fin de votre phrase et répond vocalement."
                : isStudent
                ? "3 questions maximum par élève et par cours · Réponse vocale immédiate de l'IA."
                : "Posez votre question vocalement ou par écrit pour tester la réponse de l'IA."}
            </p>
          )}
        </div>
      )}

      {/* Modale d'édition directe (enseignant / directeur) */}
      {showEditModal && editForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Edit3 size={18} className="text-purple-600" /> Modifier ce cours
              </h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Matière</label>
                  <input required value={editForm.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })} className="input text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Titre</label>
                  <input required value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="input text-sm mt-1" />
                </div>
              </div>

              {/* Voix et Langue */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700">Langue</label>
                  <select
                    value={editForm.language}
                    onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
                    className="input text-sm mt-1 bg-white"
                  >
                    <option value="fr-FR">🇫🇷 Français</option>
                    <option value="en-US">🇬🇧 Anglais</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Voix</label>
                  <select
                    value={editForm.voice}
                    onChange={(e) => setEditForm({ ...editForm, voice: e.target.value })}
                    className="input text-sm mt-1 bg-white"
                  >
                    <option value="female">👩 Féminine naturelle</option>
                    <option value="male">👨 Masculine naturelle</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Début</label>
                  <input required type="datetime-local" value={editForm.scheduledAt} onChange={(e) => setEditForm({ ...editForm, scheduledAt: e.target.value })} className="input text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Durée (min)</label>
                  <input required type="number" min={5} max={240} value={editForm.durationMinutes} onChange={(e) => setEditForm({ ...editForm, durationMinutes: Number(e.target.value) })} className="input text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Q&R (min)</label>
                  <input required type="number" min={0} max={60} value={editForm.qaDurationMinutes} onChange={(e) => setEditForm({ ...editForm, qaDurationMinutes: Number(e.target.value) })} className="input text-sm mt-1" />
                </div>
              </div>

              {/* Contenu du cours */}
              <div>
                <label className="text-xs font-medium text-gray-600">Contenu texte du cours (re-généré si modifié)</label>
                <textarea
                  rows={4}
                  value={editForm.sourceText}
                  onChange={(e) => setEditForm({ ...editForm, sourceText: e.target.value, sourceType: 'text' })}
                  placeholder="Contenu du cours..."
                  className="input text-sm mt-1"
                />
              </div>

              {/* Prochain cours */}
              <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3 space-y-2.5">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <BookOpen size={14} className="text-blue-600" /> Prochain cours & devoirs
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-medium text-gray-700">Titre</label>
                    <input
                      value={editForm.nextCourseTitle}
                      onChange={(e) => setEditForm({ ...editForm, nextCourseTitle: e.target.value })}
                      className="input text-sm mt-1 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">Date prévue</label>
                    <input
                      type="datetime-local"
                      value={editForm.nextCourseDate}
                      onChange={(e) => setEditForm({ ...editForm, nextCourseDate: e.target.value })}
                      className="input text-sm mt-1 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Consignes & devoirs</label>
                  <textarea
                    rows={2}
                    value={editForm.nextCourseInstructions}
                    onChange={(e) => setEditForm({ ...editForm, nextCourseInstructions: e.target.value })}
                    className="input text-sm mt-1 bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Support pour le prochain cours</label>
                  <div className="flex gap-2 mt-1">
                    {[['none', 'Aucun'], ['text', 'Texte'], ['pdf', 'PDF']].map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, nextCourseSourceType: v })}
                        className={`text-xs px-2.5 py-1 rounded-full border ${editForm.nextCourseSourceType === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  {editForm.nextCourseSourceType === 'text' && (
                    <textarea
                      rows={3}
                      value={editForm.nextCourseSourceText}
                      onChange={(e) => setEditForm({ ...editForm, nextCourseSourceText: e.target.value })}
                      placeholder="Texte ou résumé préparatoire du prochain cours..."
                      className="input text-sm mt-2 bg-white"
                    />
                  )}
                  {editForm.nextCourseSourceType === 'pdf' && (
                    <div className="mt-2">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => setEditForm({ ...editForm, nextPdf: e.target.files?.[0] || null })}
                        className="text-xs w-full border border-dashed border-gray-300 rounded-lg p-2 bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              {editError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{editError}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
                <button type="submit" disabled={editSaving} className="btn-primary flex-1 justify-center">
                  {editSaving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale d'agrandissement d'image plein écran */}
      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute top-3 right-3 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80 transition-colors z-10"
            >
              <X size={18} />
            </button>
            <div className="overflow-auto max-h-[75vh] flex items-center justify-center bg-gray-950 rounded-xl p-2">
              <img
                src={zoomedImage.url}
                alt={zoomedImage.caption || 'Figure agrandie'}
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
            {zoomedImage.caption && (
              <div className="p-3 text-center text-sm font-semibold text-gray-800">
                📷 {zoomedImage.caption}
              </div>
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
