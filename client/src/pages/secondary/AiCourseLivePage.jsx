import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Bot, Loader2, AlertCircle, ArrowLeft, Clock, Radio, CheckCircle2,
  Send, MessageCircle, Sparkles, Volume2, VolumeX, Mic, MicOff,
  Play, Square, BookOpen, Volume1,
} from 'lucide-react'
import { aiCoursesApi } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import {
  isSpeechSynthesisSupported, isSpeechRecognitionSupported,
  speakText, stopSpeaking, createSpeechRecognizer,
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

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  // Compte à rebours local, recalé sur serverTime à chaque poll
  const [countdown, setCountdown] = useState(null)

  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState('')

  // Voix & Audio
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [playingAnswerId, setPlayingAnswerId] = useState(null)
  const [readingFullCourse, setReadingFullCourse] = useState(false)

  // Reconnaissance vocale (Élève au micro depuis sa table)
  const [isListening, setIsListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const recognizerRef = useRef(null)

  // Synchronisation vocale du cours en direct
  const spokenUnitsCountRef = useRef(0)
  const speechQueueRef = useRef([])
  const isQueueRunningRef = useRef(false)
  const courseEndAnnouncedRef = useRef(false)

  // Compte à rebours de la session Q&R (après la fin du cours)
  const [qaCountdown, setQaCountdown] = useState(null)

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
      recognizerRef.current?.stop()
    }
  }, [])

  // Queue vocale : diffuse chaque paragraphe successivement
  const processSpeechQueue = useCallback(() => {
    if (!voiceEnabled || isQueueRunningRef.current || speechQueueRef.current.length === 0) {
      return
    }
    const nextText = speechQueueRef.current.shift()
    if (!nextText) return

    isQueueRunningRef.current = true
    setIsSpeaking(true)

    speakText(nextText, {
      lang: data?.language || 'fr-FR',
      gender: data?.voice || 'female',
      cancelBefore: false,
      enqueue: true,
      onStart: () => setIsSpeaking(true),
      onEnd: () => {
        isQueueRunningRef.current = false
        if (speechQueueRef.current.length > 0) {
          processSpeechQueue()
        } else {
          setIsSpeaking(false)
        }
      },
      onError: () => {
        isQueueRunningRef.current = false
        if (speechQueueRef.current.length > 0) {
          processSpeechQueue()
        } else {
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

  // Annonce vocale de fin de cours & ouverture des questions
  useEffect(() => {
    if (data?.status === 'termine' && !courseEndAnnouncedRef.current) {
      courseEndAnnouncedRef.current = true
      if (voiceEnabled) {
        const qaMins = data.qaDurationMinutes ?? 10
        const endAnnouncement = data.language === 'en-US'
          ? `The lesson has finished. We now have ${qaMins} minutes reserved for questions. Students, you may ask your questions using your microphone or by typing.`
          : `Le cours est maintenant terminé. Nous ouvrons la séance de questions-réponses pendant ${qaMins} minutes. Chers élèves, vous pouvez me poser vos questions vocalement depuis votre table au micro, ou par écrit.`
        setTimeout(() => {
          speakText(endAnnouncement, {
            lang: data.language || 'fr-FR',
            gender: data.voice || 'female',
            onStart: () => setIsSpeaking(true),
            onEnd: () => setIsSpeaking(false),
            onError: () => setIsSpeaking(false),
          })
        }, 1000)
      }
    }
  }, [data?.status, data?.language, data?.voice, data?.qaDurationMinutes, voiceEnabled])

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
      speechQueueRef.current = []
      isQueueRunningRef.current = false
      setIsSpeaking(false)
      setPlayingAnswerId(null)
      setReadingFullCourse(false)
      setVoiceEnabled(false)
    } else {
      setVoiceEnabled(true)
      if (data?.status === 'en_cours' && data?.units?.length > 0) {
        const units = data.units
        spokenUnitsCountRef.current = units.length
        speechQueueRef.current = [units[units.length - 1]]
        setTimeout(processSpeechQueue, 60)
      }
    }
  }

  // Enregistrement micro de la question de l'élève depuis sa table
  const handleToggleMic = () => {
    if (isListening) {
      recognizerRef.current?.stop()
      setIsListening(false)
      return
    }
    if (!isSpeechRecognitionSupported()) {
      alert('La reconnaissance vocale nécessite Google Chrome, Microsoft Edge ou Safari.')
      return
    }
    setVoiceTranscript('')
    const recognizer = createSpeechRecognizer({
      lang: data?.language || 'fr-FR',
      onResult: ({ final, full }) => {
        const text = final || full
        setVoiceTranscript(text)
        setQuestion(text)
      },
      onError: (err) => {
        console.warn('Erreur micro:', err)
        setIsListening(false)
      },
      onEnd: () => {
        setIsListening(false)
      },
    })
    recognizerRef.current = recognizer
    recognizer.start()
    setIsListening(true)
  }

  // Soumission de question (texte ou vocale) et réponse vocale immédiate de l'IA
  const handleAsk = async (e, customText) => {
    if (e) e.preventDefault()
    if (isListening) {
      recognizerRef.current?.stop()
      setIsListening(false)
    }
    const q = (customText || question).trim()
    if (!q) return
    setAsking(true)
    setAskError('')
    try {
      const res = await aiCoursesApi.askQuestion(id, q)
      setQuestion('')
      setVoiceTranscript('')
      await fetchLive()
      // L'IA répond vocalement à l'élève à voix haute
      const answer = res?.data?.question?.answer
      if (answer && voiceEnabled) {
        setIsSpeaking(true)
        speakText(answer, {
          lang: data?.language || 'fr-FR',
          gender: data?.voice || 'female',
          onStart: () => setIsSpeaking(true),
          onEnd: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        })
      }
      // Descend vers la réponse fraîchement ajoutée
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 300)
    } catch (e2) { setAskError(e2.message) }
    setAsking(false)
  }

  const handlePlayAnswer = (q) => {
    if (playingAnswerId === q._id) {
      stopSpeaking()
      setPlayingAnswerId(null)
      setIsSpeaking(false)
      return
    }
    stopSpeaking()
    setPlayingAnswerId(q._id)
    setIsSpeaking(true)
    speakText(q.answer, {
      lang: data?.language || 'fr-FR',
      gender: data?.voice || 'female',
      onStart: () => {
        setPlayingAnswerId(q._id)
        setIsSpeaking(true)
      },
      onEnd: () => {
        setPlayingAnswerId(null)
        setIsSpeaking(false)
      },
      onError: () => {
        setPlayingAnswerId(null)
        setIsSpeaking(false)
      },
    })
  }

  const handlePlayFullCourse = () => {
    if (readingFullCourse) {
      stopSpeaking()
      setReadingFullCourse(false)
      setIsSpeaking(false)
      return
    }
    stopSpeaking()
    setReadingFullCourse(true)
    setIsSpeaking(true)
    speakText(data?.text || '', {
      lang: data?.language || 'fr-FR',
      gender: data?.voice || 'female',
      onStart: () => {
        setReadingFullCourse(true)
        setIsSpeaking(true)
      },
      onEnd: () => {
        setReadingFullCourse(false)
        setIsSpeaking(false)
      },
      onError: () => {
        setReadingFullCourse(false)
        setIsSpeaking(false)
      },
    })
  }

  const handlePlayNextCourse = () => {
    const text = data?.language === 'en-US'
      ? `For our next class titled ${data.nextCourseTitle || 'Next Session'} : ${data.nextCourseInstructions || ''}`
      : `Pour notre prochain cours intitulé ${data.nextCourseTitle || 'Séance suivante'} : ${data.nextCourseInstructions || ''}`
    speakText(text, {
      lang: data?.language || 'fr-FR',
      gender: data?.voice || 'female',
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
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
        </div>
      )}

      {/* Statuts d'échec */}
      {data.status === 'annule' && (
        <div className="card p-10 text-center text-gray-500"><AlertCircle size={32} className="mx-auto mb-3 text-amber-400" /><p className="text-sm">Ce cours a été annulé.</p></div>
      )}
      {data.status === 'erreur' && (
        <div className="card p-10 text-center text-gray-500"><AlertCircle size={32} className="mx-auto mb-3 text-red-400" /><p className="text-sm">Ce cours n'a pas pu être diffusé.</p>{data.generationError && <p className="text-xs text-gray-400 mt-1">{data.generationError}</p>}</div>
      )}

      {/* Le tableau : texte du cours qui s'écrit */}
      {(isLive || isDone) && (
        <div className="card p-5 sm:p-8 bg-white relative">
          {data.usedFallback && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 mb-4">Cours diffusé à partir du contenu du professeur.</p>
          )}
          <div className="prose-sm max-w-none text-[15px] leading-7 text-gray-800 whitespace-pre-wrap">
            {data.text}
            {isLive && <span className="inline-block w-0.5 h-4 bg-purple-500 ml-0.5 align-middle animate-pulse" />}
          </div>
          {isLive && !data.text && (
            <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Le cours démarre...</p>
          )}
        </div>
      )}

      {/* Annonce du prochain cours & devoirs (si renseigné par l'enseignant) */}
      {isDone && (data.nextCourseTitle || data.nextCourseInstructions || data.nextCourseDate) && (
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
            <p className="text-xs text-gray-400">Aucune question pour l'instant.{isStudent ? ' Posez votre question au micro depuis votre table ou écrivez-la !' : ''}</p>
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

          {isStudent && (
            <div className="sticky bottom-4 space-y-2">
              {/* Alerte visuelle quand le micro écoute l'élève depuis sa table */}
              {isListening && (
                <div className="bg-purple-900 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between text-xs animate-pulse">
                  <span className="flex items-center gap-2 font-medium">
                    <Mic size={15} className="text-red-400 animate-bounce" />
                    Parlez à voix haute depuis votre table... L'IA vous écoute !
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleMic}
                    className="bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-md text-white text-[11px] font-semibold"
                  >
                    Arrêter
                  </button>
                </div>
              )}

              <form onSubmit={(e) => handleAsk(e)} className="bg-white border border-gray-200 rounded-2xl shadow-card p-2 flex items-end gap-2">
                {isSpeechRecognitionSupported() && (
                  <button
                    type="button"
                    onClick={handleToggleMic}
                    title="Poser ma question au micro depuis ma table"
                    className={`p-2.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold ${
                      isListening
                        ? 'bg-red-500 text-white animate-pulse shadow-md'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                    }`}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    <span className="hidden sm:inline">{isListening ? 'Écoute...' : 'Parler au micro'}</span>
                  </button>
                )}
                <textarea
                  rows={1}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(e) } }}
                  placeholder={isListening ? "Parlez depuis votre table, l'IA transcrit en direct..." : "Posez votre question (parlez au micro ou écrivez ici)..."}
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
          {isStudent && <p className="text-[10px] text-gray-400 text-center">3 questions maximum par élève et par cours · L'IA répondra vocalement à vos questions.</p>}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
