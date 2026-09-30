import { useState } from 'react'
import { aiApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import {
  Bot, Sparkles, Loader2, Plus, Pencil, Trash2, X, CheckCircle2, XCircle, Ban, Play,
  Settings, Package, ClipboardList, BarChart2, Image as ImageIcon, Clock,
  Key, Eye, EyeOff, ExternalLink, HelpCircle, AlertCircle, Check,
} from 'lucide-react'

const STATUS_BADGE = {
  pending: { label: 'En attente', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approuvée', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejetée', cls: 'bg-red-100 text-red-700' },
  expired: { label: 'Épuisée', cls: 'bg-gray-100 text-gray-600' },
  suspended: { label: 'Suspendue', cls: 'bg-red-100 text-red-700' },
}

export default function AdminAiPage() {
  const [tab, setTab] = useState('requests')
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Bot size={22} className="text-indigo-600" /> Assistant IA — Administration</h1>
        <p className="text-sm text-gray-500">Offres, demandes de souscription, configuration et statistiques globales.</p>
      </div>

      <div className="flex gap-1 border-b border-gray-100 overflow-x-auto">
        {[
          { id: 'requests', label: 'Demandes', icon: ClipboardList },
          { id: 'packages', label: 'Offres', icon: Package },
          { id: 'config', label: 'Configuration', icon: Settings },
          { id: 'stats', label: 'Statistiques', icon: BarChart2 },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap ${tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'requests' && <RequestsTab />}
      {tab === 'packages' && <PackagesTab />}
      {tab === 'config' && <ConfigTab />}
      {tab === 'stats' && <StatsTab />}
    </div>
  )
}

// ── Demandes ──────────────────────────────────────────────────────────────────
function RequestsTab() {
  const [statusFilter, setStatusFilter] = useState('')
  const q = useCachedFetch(`/ai/subscriptions?status=${statusFilter}`, async () => {
    const r = await aiApi.listSubscriptions(statusFilter)
    return r.data || []
  }, [statusFilter])
  const [busy, setBusy] = useState(null)
  const [preview, setPreview] = useState(null)
  const subs = q.data || []

  const refresh = () => { cache.invalidate('/ai/subscriptions'); q.refetch() }

  const approve = async (s) => {
    setBusy(s._id)
    try { await aiApi.approveSubscription(s._id); refresh() } catch (err) { alert(err.message) }
    setBusy(null)
  }
  const reject = async (s) => {
    const reason = window.prompt('Motif du rejet (optionnel) :')
    if (reason === null) return
    setBusy(s._id)
    try { await aiApi.rejectSubscription(s._id, reason); refresh() } catch (err) { alert(err.message) }
    setBusy(null)
  }
  const suspend = async (s) => {
    if (!window.confirm('Suspendre l\'accès IA de cet établissement ?')) return
    setBusy(s._id)
    try { await aiApi.suspendSubscription(s._id); refresh() } catch (err) { alert(err.message) }
    setBusy(null)
  }
  const reactivate = async (s) => {
    setBusy(s._id)
    try { await aiApi.reactivateSubscription(s._id); refresh() } catch (err) { alert(err.message) }
    setBusy(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'approved', 'rejected', 'suspended', 'expired'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s === '' ? 'Toutes' : (STATUS_BADGE[s]?.label || s)}
          </button>
        ))}
      </div>

      {q.loading ? (
        <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : subs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">Aucune demande.</p>
      ) : (
        <div className="space-y-3">
          {subs.map((s) => (
            <div key={s._id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">{s.school?.name || 'École'}</p>
                  <p className="text-xs text-gray-500">{s.director?.name} · {s.director?.email}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
                    <span>Offre : <strong>{s.packageName}</strong></span>
                    <span>{s.totalQuestions} questions</span>
                    <span>{Number(s.price).toLocaleString()} {s.currency}</span>
                    <span>{s.usedQuestions}/{s.totalQuestions} utilisées</span>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[s.status]?.cls}`}>{STATUS_BADGE[s.status]?.label}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                {s.paymentScreenshot && (
                  <button onClick={() => setPreview(s.paymentScreenshot)} className="text-xs flex items-center gap-1 text-blue-600 hover:underline"><ImageIcon size={13} /> Voir la capture</button>
                )}
                <div className="flex gap-2 ml-auto">
                  {s.status === 'pending' && (
                    <>
                      <button onClick={() => approve(s)} disabled={busy === s._id} className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white font-medium flex items-center gap-1 disabled:opacity-50"><CheckCircle2 size={13} /> Approuver</button>
                      <button onClick={() => reject(s)} disabled={busy === s._id} className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-medium flex items-center gap-1 disabled:opacity-50"><XCircle size={13} /> Rejeter</button>
                    </>
                  )}
                  {s.status === 'approved' && (
                    <button onClick={() => suspend(s)} disabled={busy === s._id} className="text-xs px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 font-medium flex items-center gap-1 disabled:opacity-50"><Ban size={13} /> Suspendre</button>
                  )}
                  {s.status === 'suspended' && (
                    <button onClick={() => reactivate(s)} disabled={busy === s._id} className="text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 font-medium flex items-center gap-1 disabled:opacity-50"><Play size={13} /> Réactiver</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <img src={preview} alt="Capture de paiement" className="max-w-full max-h-[90vh] rounded-lg" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setPreview(null)} className="absolute top-4 right-4 text-white"><X size={24} /></button>
        </div>
      )}
    </div>
  )
}

// ── Offres ────────────────────────────────────────────────────────────────────
const EMPTY_PKG = { name: '', description: '', totalQuestions: '', price: '', currency: 'F CFA', isActive: true, sortOrder: 0 }

function PackagesTab() {
  const q = useCachedFetch('/ai/packages', async () => {
    const r = await aiApi.listPackages()
    return r.data || []
  }, [])
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const packages = q.data || []
  const refresh = () => { cache.invalidate('/ai/packages'); q.refetch() }

  const save = async (e) => {
    e.preventDefault()
    if (!modal.name.trim() || !modal.totalQuestions || modal.price === '') return
    setSaving(true)
    try {
      const payload = {
        name: modal.name.trim(),
        description: modal.description?.trim() || '',
        totalQuestions: Number(modal.totalQuestions),
        price: Number(modal.price),
        currency: modal.currency || 'F CFA',
        isActive: modal.isActive,
        sortOrder: Number(modal.sortOrder) || 0,
      }
      if (modal._id) await aiApi.updatePackage(modal._id, payload)
      else await aiApi.createPackage(payload)
      setModal(null); refresh()
    } catch (err) { alert(err.message) }
    setSaving(false)
  }
  const remove = async (p) => {
    if (!window.confirm(`Supprimer l'offre « ${p.name} » ?`)) return
    try { await aiApi.removePackage(p._id); refresh() } catch (err) { alert(err.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModal({ ...EMPTY_PKG })} className="btn-primary text-sm justify-center"><Plus size={15} /> Nouvelle offre</button>
      </div>
      {q.loading ? (
        <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : packages.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">Aucune offre. Créez la première.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {packages.map((p) => (
            <div key={p._id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">{p.name}</p>
                  {!p.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setModal({ ...EMPTY_PKG, ...p, totalQuestions: p.totalQuestions, price: p.price })} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-blue-600"><Pencil size={14} /></button>
                  <button onClick={() => remove(p)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
              {p.description && <p className="text-xs text-gray-500 mt-1">{p.description}</p>}
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-lg font-bold text-indigo-600">{Number(p.price).toLocaleString()}</span>
                <span className="text-xs text-gray-400">{p.currency}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{p.totalQuestions} questions incluses</p>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">{modal._id ? 'Modifier l\'offre' : 'Nouvelle offre'}</h3>
              <button onClick={() => setModal(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Nom de l'offre *</label>
                <input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} required className="input text-sm w-full mt-1" placeholder="Ex. Pack Découverte" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Description</label>
                <input value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} className="input text-sm w-full mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Questions incluses *</label>
                  <input type="number" min="1" value={modal.totalQuestions} onChange={(e) => setModal({ ...modal, totalQuestions: e.target.value })} required className="input text-sm w-full mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Prix *</label>
                  <input type="number" min="0" value={modal.price} onChange={(e) => setModal({ ...modal, price: e.target.value })} required className="input text-sm w-full mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Devise</label>
                  <input value={modal.currency} onChange={(e) => setModal({ ...modal, currency: e.target.value })} className="input text-sm w-full mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Ordre</label>
                  <input type="number" value={modal.sortOrder} onChange={(e) => setModal({ ...modal, sortOrder: e.target.value })} className="input text-sm w-full mt-1" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={modal.isActive} onChange={(e) => setModal({ ...modal, isActive: e.target.checked })} /> Offre active (visible par les directeurs)
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className="btn-ghost border border-gray-200 flex-1 justify-center text-sm">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center text-sm">{saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {modal._id ? 'Enregistrer' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Configuration Multi-Fournisseurs & Clés API ──────────────────────────────
const PROVIDERS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Recommandé',
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    description: 'Dernière génération Gemini 3.8 : vitesse fulgurante, raisonnement multimodal et précision pédagogique.',
    models: ['gemini-3.8-flash', 'gemini-3.8-pro', 'gemini-3.5-flash', 'gemini-3.1-pro', 'gemini-2.5-flash'],
    defaultModel: 'gemini-3.8-flash',
    keyField: 'geminiApiKey',
    maskedField: 'geminiApiKeyMasked',
    hasKeyField: 'hasGeminiKey',
    url: 'https://aistudio.google.com/app/apikey',
    urlLabel: 'Obtenir la clé Google AI Studio',
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    badge: 'Standard & Raisonnement',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
    description: 'Modèles de pointe GPT-5, GPT-4o polyvalents et raisonnement logique approfondi o3-mini & o1.',
    models: ['gpt-5', 'gpt-5.6', 'gpt-4o-mini', 'gpt-4o', 'o3-mini', 'o1', 'o1-mini'],
    defaultModel: 'gpt-4o-mini',
    keyField: 'openaiApiKey',
    maskedField: 'openaiApiKeyMasked',
    hasKeyField: 'hasOpenaiKey',
    url: 'https://platform.openai.com/api-keys',
    urlLabel: 'Console OpenAI API',
  },
  {
    id: 'groq',
    name: 'Groq (Llama / DeepSeek)',
    badge: 'Ultra-Rapide',
    badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
    description: 'Inférence LPU fulgurante (>500 tokens/sec) avec Llama 3.3 70B et DeepSeek R1.',
    models: ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.3-70b-versatile',
    keyField: 'groqApiKey',
    maskedField: 'groqApiKeyMasked',
    hasKeyField: 'hasGroqKey',
    url: 'https://console.groq.com/keys',
    urlLabel: 'Groq Cloud Console',
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    badge: 'Pédagogique Avancé',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
    description: 'Claude Opus 5.5, Opus 4.8 et Sonnet 5.5 : puissance de calcul maximale, nuance et raisonnement.',
    models: [
      'claude-opus-5-5',
      'claude-opus-4-8',
      'claude-sonnet-5-5',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ],
    defaultModel: 'claude-opus-5-5',
    keyField: 'anthropicApiKey',
    maskedField: 'anthropicApiKeyMasked',
    hasKeyField: 'hasAnthropicKey',
    url: 'https://console.anthropic.com/settings/keys',
    urlLabel: 'Console Anthropic Claude',
  },
]

function ConfigTab() {
  const q = useCachedFetch('/ai/config', async () => {
    const r = await aiApi.getConfig()
    return r.data
  }, [])

  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null) // { success: boolean, message: string, answer?: string }
  const [activeHelp, setActiveHelp] = useState(null)

  const cfg = q.data
  if (cfg && !form) {
    let initialModel = cfg.model
    if (cfg.provider === 'gemini' && (!initialModel || initialModel.includes('gemini-2.0') || initialModel.includes('gemini-1.5'))) {
      initialModel = 'gemini-3.8-flash'
    }
    setForm({
      ...cfg,
      model: initialModel,
      provider: cfg.provider || 'gemini',
      geminiApiKey: '',
      openaiApiKey: '',
      anthropicApiKey: '',
      groqApiKey: '',
    })
  }

  const currentProvider = PROVIDERS.find((p) => p.id === (form?.provider || 'gemini')) || PROVIDERS[0]
  const currentKeyVal = form ? form[currentProvider.keyField] : ''
  const currentMaskedKey = cfg ? cfg[currentProvider.maskedField] : ''
  const isKeyConfigured = cfg ? cfg[currentProvider.hasKeyField] : false

  const handleProviderChange = (pId) => {
    const p = PROVIDERS.find((item) => item.id === pId)
    setForm({
      ...form,
      provider: pId,
      model: p?.defaultModel || form.model,
    })
    setTestResult(null)
  }

  const handleTestKey = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await aiApi.testKey({
        provider: form.provider,
        apiKey: form[currentProvider.keyField],
        model: form.model,
      })
      setTestResult({
        success: true,
        message: res.message || 'Connexion réussie avec le modèle IA !',
        answer: res.answer,
      })
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message || 'Échec du test de connexion.',
      })
    } finally {
      setTesting(false)
    }
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      const payload = {
        enabled: form.enabled,
        provider: form.provider,
        model: form.model,
        systemPrompt: form.systemPrompt,
        temperature: Number(form.temperature),
        maxTokens: Number(form.maxTokens),
      }
      if (form.geminiApiKey) payload.geminiApiKey = form.geminiApiKey
      if (form.openaiApiKey) payload.openaiApiKey = form.openaiApiKey
      if (form.anthropicApiKey) payload.anthropicApiKey = form.anthropicApiKey
      if (form.groqApiKey) payload.groqApiKey = form.groqApiKey

      await aiApi.updateConfig(payload)
      cache.invalidate('/ai/config')
      q.refetch()
      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
    } catch (err) {
      alert(err.message)
    }
    setSaving(false)
  }

  if (q.loading || !form) {
    return (
      <div className="py-12 text-center">
        <Loader2 size={24} className="animate-spin mx-auto text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Interrupteur Principal ── */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">État du service IA</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Activez ou désactivez globalement l'IA pour l'ensemble des établissements scolaires.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ ...form, enabled: !form.enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            form.enabled ? 'bg-indigo-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              form.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* ── Sélection du Fournisseur ── */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Fournisseur & Moteur d'IA</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Choisissez le fournisseur d'intelligence artificielle qui alimentera le chat et les cours IA.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROVIDERS.map((p) => {
            const isSelected = form.provider === p.id
            const hasKey = cfg && cfg[p.hasKeyField]
            return (
              <div
                key={p.id}
                onClick={() => handleProviderChange(p.id)}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/30 shadow-sm'
                    : 'border-gray-100 hover:border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                    {p.name}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${p.badgeColor}`}>
                    {p.badge}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2 leading-relaxed">{p.description}</p>
                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-gray-100">
                  <span className="text-gray-400">Statut clé API :</span>
                  {hasKey ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <Check size={12} /> Configurée
                    </span>
                  ) : (
                    <span className="text-amber-700 font-medium">Non configurée</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Configuration de la clé API et du modèle actif ── */}
      <form onSubmit={save} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-5">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Key size={16} className="text-indigo-600" />
            Paramètres {currentProvider.name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Insérez votre clé API et sélectionnez le modèle à exécuter pour les requêtes des écoles.
          </p>
        </div>

        {/* Saisie de la Clé API */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              Clé API {currentProvider.name} *
              {isKeyConfigured && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-normal">
                  Actuellement configurée ({currentMaskedKey})
                </span>
              )}
            </label>
            <a
              href={currentProvider.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
            >
              {currentProvider.urlLabel} <ExternalLink size={12} />
            </a>
          </div>

          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={currentKeyVal}
              onChange={(e) => setForm({ ...form, [currentProvider.keyField]: e.target.value })}
              className="input text-sm w-full font-mono pr-20"
              placeholder={isKeyConfigured ? currentMaskedKey : `Collez votre clé API ${currentProvider.name} ici...`}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 rounded bg-gray-50 border border-gray-200"
            >
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
              {showKey ? 'Masquer' : 'Afficher'}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Laissez vide pour conserver la clé actuelle. La clé reste chiffrée et sécurisée côté serveur.
          </p>
        </div>

        {/* Sélection du modèle */}
        <div>
          <label className="text-xs font-semibold text-gray-700 block mb-1.5">Modèle d'IA</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {currentProvider.models.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setForm({ ...form, model: m })}
                className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-colors ${
                  form.model === m
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <input
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            className="input text-sm w-full font-mono"
            placeholder={currentProvider.defaultModel}
          />
        </div>

        {/* Bouton de Test en Direct */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-gray-800">Tester la connectivité</h4>
              <p className="text-[11px] text-gray-500">
                Envoie une requête de vérification instantanée pour confirmer la validité de la clé et du modèle.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestKey}
              disabled={testing || (!currentKeyVal && !isKeyConfigured)}
              className="btn-secondary text-xs inline-flex items-center gap-1.5 shrink-0"
            >
              {testing ? <Loader2 size={13} className="animate-spin text-indigo-600" /> : <Play size={13} />}
              {testing ? 'Test en cours...' : 'Tester la connexion IA'}
            </button>
          </div>

          {testResult && (
            <div
              className={`mt-3 p-3 rounded-lg text-xs flex items-start gap-2 border ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold">{testResult.message}</p>
                {testResult.answer && (
                  <p className="mt-1 text-[11px] bg-white/70 p-2 rounded border border-emerald-200 text-gray-700">
                    Réponse du modèle : <span className="italic">« {testResult.answer} »</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Consigne système */}
        <div>
          <label className="text-xs font-semibold text-gray-700 block mb-1">
            Consigne système (rôle pédagogique & sécurité)
          </label>
          <textarea
            value={form.systemPrompt}
            onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            rows={5}
            className="input text-xs sm:text-sm w-full resize-y font-sans leading-relaxed"
          />
        </div>

        {/* Hyperparamètres */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Température (0 à 2)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: e.target.value })}
              className="input text-sm w-full"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">0.2 = précis et factuel, 0.7 = créatif.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Longueur max (Tokens)</label>
            <input
              type="number"
              min="50"
              max="8000"
              value={form.maxTokens}
              onChange={(e) => setForm({ ...form, maxTokens: e.target.value })}
              className="input text-sm w-full"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">Environ 1 token = 4 caractères en français.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary text-sm inline-flex items-center gap-2"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Settings size={15} />}
            Enregistrer la configuration IA
          </button>
          {saved && (
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle2 size={15} /> Paramètres enregistrés avec succès !
            </span>
          )}
        </div>
      </form>

      {/* ── Guide Étape par Étape : Comment obtenir les clés API ── */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <HelpCircle size={16} className="text-blue-600" />
          Guide : Comment obtenir vos clés API pour les insérer ?
        </h3>

        <div className="space-y-2 text-xs">
          <details className="p-3 bg-gray-50 rounded-lg cursor-pointer">
            <summary className="font-semibold text-gray-800">
              1. Google Gemini (Gemini 3.8 Flash & Pro — Option recommandée)
            </summary>
            <div className="mt-2 text-gray-600 space-y-1.5 pl-4 border-l-2 border-emerald-400">
              <p>1. Rendez-vous sur <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">Google AI Studio</a>.</p>
              <p>2. Connectez-vous avec votre compte Google (Gmail).</p>
              <p>3. Cliquez sur le bouton bleu <strong>« Create API key »</strong>.</p>
              <p>4. Choisissez un projet ou laissez le projet par défaut, puis cliquez sur <strong>« Create API key in new project »</strong>.</p>
              <p>5. Copiez la clé générée (commence par <code className="bg-gray-200 px-1 rounded">AIzaSy...</code>) et collez-la ci-dessus dans le champ <strong>Clé API Google Gemini</strong>.</p>
              <p>6. Sélectionnez le modèle recommandé <strong>gemini-3.8-flash</strong> (ou <strong>gemini-3.8-pro</strong>), cliquez sur <strong>« Tester la connexion IA »</strong> puis <strong>« Enregistrer »</strong>.</p>
            </div>
          </details>

          <details className="p-3 bg-gray-50 rounded-lg cursor-pointer">
            <summary className="font-semibold text-gray-800">
              2. OpenAI (ChatGPT — GPT-5, GPT-4o, o3-mini & o1)
            </summary>
            <div className="mt-2 text-gray-600 space-y-1.5 pl-4 border-l-2 border-blue-400">
              <p>1. Rendez-vous sur <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">platform.openai.com/api-keys</a>.</p>
              <p>2. Créez un compte ou connectez-vous.</p>
              <p>3. Cliquez sur <strong>« Create new secret key »</strong>, donnez-lui un nom (ex: <code className="bg-gray-200 px-1 rounded">KATD-SCHÜLE</code>).</p>
              <p>4. Copiez immédiatement la clé secrète (<code className="bg-gray-200 px-1 rounded">sk-proj-...</code>) et collez-la dans le champ ci-dessus.</p>
              <p>5. Sélectionnez <strong>gpt-5</strong>, <strong>gpt-4o</strong>, <strong>gpt-4o-mini</strong> ou un modèle de raisonnement comme <strong>o3-mini</strong>.</p>
            </div>
          </details>

          <details className="p-3 bg-gray-50 rounded-lg cursor-pointer">
            <summary className="font-semibold text-gray-800">
              3. Groq (Llama 3.3 70B & DeepSeek R1 — Ultra-rapide)
            </summary>
            <div className="mt-2 text-gray-600 space-y-1.5 pl-4 border-l-2 border-amber-400">
              <p>1. Rendez-vous sur <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">console.groq.com/keys</a>.</p>
              <p>2. Connectez-vous avec votre compte Google ou GitHub.</p>
              <p>3. Cliquez sur <strong>« Create API Key »</strong>.</p>
              <p>4. Copiez la clé (<code className="bg-gray-200 px-1 rounded">gsk_...</code>) et collez-la dans le champ Groq.</p>
              <p>5. Choisissez <strong>llama-3.3-70b-versatile</strong> ou <strong>deepseek-r1-distill-llama-70b</strong>.</p>
            </div>
          </details>

          <details className="p-3 bg-gray-50 rounded-lg cursor-pointer">
            <summary className="font-semibold text-gray-800">
              4. Anthropic Claude (Opus 5.5, Opus 4.8 & Claude 3.7 / 3.5 Sonnet)
            </summary>
            <div className="mt-2 text-gray-600 space-y-1.5 pl-4 border-l-2 border-purple-400">
              <p>1. Rendez-vous sur <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">console.anthropic.com</a>.</p>
              <p>2. Créez une clé API (<code className="bg-gray-200 px-1 rounded">sk-ant-...</code>) et insérez-la ci-dessus.</p>
              <p>3. Sélectionnez le modèle surpuissant <strong>claude-opus-5-5</strong>, <strong>claude-opus-4-8</strong> ou <strong>claude-3-7-sonnet-20250219</strong>.</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}

// ── Statistiques globales ─────────────────────────────────────────────────────
function StatsTab() {
  const q = useCachedFetch('/ai/stats', async () => {
    const r = await aiApi.stats()
    return r.data
  }, [])
  if (q.loading) return <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
  const d = q.data || {}
  const perSchool = d.perSchool || []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi icon={Sparkles} label="Écoles actives" value={d.activeSchools || 0} tone="bg-indigo-50 text-indigo-600" />
        <Kpi icon={Clock} label="Demandes en attente" value={d.pendingRequests || 0} tone="bg-amber-50 text-amber-600" />
        <Kpi icon={Bot} label="Questions posées" value={d.totalQuestionsAsked || 0} tone="bg-green-50 text-green-600" />
        <Kpi icon={BarChart2} label="Quota consommé" value={`${d.totalUsedQuota || 0}/${d.totalAllowedQuota || 0}`} tone="bg-blue-50 text-blue-600" />
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Consommation par établissement</h3>
        {perSchool.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Aucune donnée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[360px]">
              <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">École</th><th className="pb-2 font-medium text-right">Utilisées</th><th className="pb-2 font-medium text-right">Total</th><th className="pb-2 font-medium text-right">%</th>
              </tr></thead>
              <tbody>
                {perSchool.map((s, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 text-gray-900">{s.schoolName || '—'}</td>
                    <td className="py-2 text-right font-semibold text-gray-900">{s.used}</td>
                    <td className="py-2 text-right text-gray-500">{s.total}</td>
                    <td className="py-2 text-right text-gray-400">{s.total ? Math.round((s.used / s.total) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Kpi({ icon: Icon, label, value, tone }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone}`}><Icon size={20} /></div>
      <div className="min-w-0"><p className="text-xs text-gray-500 truncate">{label}</p><p className="text-lg font-bold text-gray-900 truncate">{value}</p></div>
    </div>
  )
}
