import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Bot, Loader2, AlertCircle, ArrowLeft, Clock, Radio, CheckCircle2,
  Send, MessageCircle, Sparkles,
} from 'lucide-react'
import { aiCoursesApi } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

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

  const handleAsk = async (e) => {
    e.preventDefault()
    const q = question.trim()
    if (!q) return
    setAsking(true)
    setAskError('')
    try {
      await aiCoursesApi.askQuestion(id, q)
      setQuestion('')
      await fetchLive()
      // Descend vers la réponse fraîchement ajoutée
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 300)
    } catch (e2) { setAskError(e2.message) }
    setAsking(false)
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
        <div className="card p-5 sm:p-8 bg-white">
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

      {/* Fin du cours : questions */}
      {isDone && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2"><MessageCircle size={16} className="text-purple-600" /> Questions des élèves</h2>

          {myQuestions.length === 0 && (
            <p className="text-xs text-gray-400">Aucune question pour l'instant.{isStudent ? ' Soyez le premier à demander !' : ''}</p>
          )}
          {myQuestions.map((q) => (
            <div key={q._id} className="space-y-2">
              <div className="flex justify-end">
                <div className="bg-purple-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[85%]">
                  <p className="text-[10px] opacity-70 font-semibold">{q.studentName}</p>
                  <p className="text-sm">{q.question}</p>
                </div>
              </div>
              {q.answer && (
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5"><Bot size={14} className="text-purple-600" /></div>
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{q.answer}</p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isStudent && (
            <form onSubmit={handleAsk} className="sticky bottom-4 bg-white border border-gray-200 rounded-2xl shadow-card p-2 flex items-end gap-2">
              <textarea
                rows={1}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(e) } }}
                placeholder="Posez votre question sur le cours..."
                maxLength={500}
                className="flex-1 resize-none text-sm px-3 py-2 outline-none bg-transparent"
              />
              <button type="submit" disabled={asking || !question.trim()} className="btn-primary p-2.5 rounded-xl disabled:opacity-50">
                {asking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          )}
          {askError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{askError}</p>}
          {isStudent && <p className="text-[10px] text-gray-400 text-center">3 questions maximum par élève et par cours.</p>}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
