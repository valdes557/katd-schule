import { useRef, useState, useEffect } from 'react'
import {
  ArrowLeftRight, Loader2, RefreshCw, TrendingUp, TrendingDown, Scale, Hash,
  CheckCircle2, Clock, XCircle, ChevronLeft, ChevronRight, Users, Building2,
  ArrowUpFromLine, Phone, User as UserIcon, Zap, RotateCcw, AlertTriangle, Send, Check,
} from 'lucide-react'
import { walletAdminApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { cn } from '../lib/utils'
import DownloadPdfButton from '../components/DownloadPdfButton'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// Natures d'opération (doit rester aligné avec CATEGORY_LABELS côté serveur)
const CATEGORIES = [
  { value: 'subscription', label: 'Souscription' },
  { value: 'enrollment', label: 'Inscription élève' },
  { value: 'deposit', label: 'Dépôt portefeuille' },
  { value: 'salary_transfer', label: 'Transfert salaire' },
  { value: 'salary_received', label: 'Salaire reçu' },
  { value: 'withdrawal', label: 'Retrait' },
  { value: 'withdrawal_refund', label: 'Remboursement retrait' },
  { value: 'adjustment', label: 'Ajustement' },
  { value: 'transfer_sent', label: 'Transfert envoyé' },
  { value: 'transfer_received', label: 'Transfert reçu' },
  { value: 'transfer_fee', label: 'Frais de transfert' },
  { value: 'fee_collected', label: 'Frais encaissés' },
  { value: 'pension_payment', label: 'Paiement pension' },
  { value: 'pension_received', label: 'Pension reçue' },
]

const STATUS_MAP = {
  completed: { label: 'Effectué', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  approved: { label: 'Encaissé', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  pending: { label: 'En attente', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  rejected: { label: 'Rejeté', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  expired: { label: 'Expiré', icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' },
}

const ROLE_LABELS = {
  super_admin: 'Administrateur', directeur: 'Directeur', enseignant: 'Enseignant',
  parent: 'Parent', eleve: 'Élève', utilisateur: 'Utilisateur', admin: 'Administrateur',
}

const OPERATOR_LABELS = { mtn: 'MTN', moov: 'Moov', celtiis: 'Celtiis' }

// ─────────── Gestion des retraits en attente (confirmation admin) ───────────
function PendingWithdrawals({ onProcessed }) {
  const [busyId, setBusyId] = useState(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [minWithdrawal, setMinWithdrawal] = useState(100)
  const [savingMin, setSavingMin] = useState(false)
  const [statusFilter, setStatusFilter] = useState('pending') // 'pending' | 'all'

  const key = '/admin/withdrawals?status=' + statusFilter
  const query = useCachedFetch(key, () => walletAdminApi.withdrawals(statusFilter), [statusFilter])
  const list = query.data?.withdrawals || []
  const loading = query.loading

  const refresh = () => { cache.invalidate('/admin/withdrawals'); query.refetch() }
  const flash = (m) => { setMsg(m); setError(''); setTimeout(() => setMsg(''), 6000) }

  useEffect(() => {
    walletAdminApi.getWithdrawalConfig().then((r) => {
      if (r && r.minWithdrawal) setMinWithdrawal(r.minWithdrawal)
    }).catch(() => {})
  }, [])

  const handleSetMin = async (val) => {
    setSavingMin(true)
    try {
      const res = await walletAdminApi.updateWithdrawalConfig(val)
      setMinWithdrawal(res.minWithdrawal || val)
      flash(`Seuil minimum de retrait fixé à ${fmt(val)} FCFA avec succès !`)
    } catch (e) {
      setError(e.message || 'Impossible de mettre à jour le seuil')
    } finally {
      setSavingMin(false)
    }
  }

  const handleCustomMin = async () => {
    const raw = window.prompt("Entrez le montant minimum de retrait souhaité (en FCFA) :", String(minWithdrawal))
    if (!raw) return
    const num = Number(raw.replace(/[^0-9]/g, ''))
    if (!num || num < 10) {
      alert("Montant invalide (minimum 10 FCFA)")
      return
    }
    handleSetMin(num)
  }

  // 1. Déclencher le virement RÉEL via l'API Ikeepay vers Orange/MTN
  const handlePayoutIkeepay = async (wr) => {
    const confirmMsg = `⚡ Déclencher le virement RÉEL Ikeepay ?\n\n` +
      `• Bénéficiaire : ${wr.accountName || wr.user?.name || '—'}\n` +
      `• Numéro : ${wr.momoNumber} (${(wr.momoOperator || '').toUpperCase()} - ${wr.country || 'CM'})\n` +
      `• Montant net à verser : ${fmt(wr.netAmount)} ${wr.currency || 'XAF'}\n\n` +
      `L'argent sera débité de votre solde marchand Ikeepay et envoyé directement sur le téléphone du client.`
    if (!window.confirm(confirmMsg)) return
    setBusyId(wr._id); setError(''); setMsg('')
    try {
      const res = await walletAdminApi.payoutWithdrawal(wr._id)
      flash(res.message || 'Virement Ikeepay envoyé avec succès !')
      refresh()
      onProcessed?.()
    } catch (e) {
      setError(e.message || "Erreur lors du virement Ikeepay")
      refresh()
    } finally {
      setBusyId(null)
    }
  }

  // 2. Annuler et rembourser le portefeuille de l'utilisateur
  const handleRefund = async (wr) => {
    const reason = window.prompt("Motif du remboursement au portefeuille de l'utilisateur :", "Annulation de la demande de retrait")
    if (reason === null) return
    setBusyId(wr._id); setError(''); setMsg('')
    try {
      await walletAdminApi.refundWithdrawal(wr._id, reason)
      flash(`Retrait remboursé : ${fmt(wr.amount)} FCFA ont été recrédités au solde de l'utilisateur.`)
      refresh()
      onProcessed?.()
    } catch (e) {
      setError(e.message || "Erreur lors du remboursement")
    } finally {
      setBusyId(null)
    }
  }

  // 3. Marquer comme payé manuellement (sans Ikeepay)
  const handleManualPay = async (wr) => {
    if (!window.confirm(`Marquer manuellement ce retrait comme PAYÉ (sans appel à Ikeepay) ?\n\nÀ n'utiliser que si vous avez déjà transféré les ${fmt(wr.netAmount)} F par vos propres moyens.`)) return
    setBusyId(wr._id); setError(''); setMsg('')
    try {
      await walletAdminApi.payWithdrawal(wr._id, 'Payé manuellement par admin (hors plateforme)')
      flash('Retrait marqué comme payé manuellement.')
      refresh()
      onProcessed?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="card overflow-hidden border-l-4 border-orange-400">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-wrap gap-2">
        <div>
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <ArrowUpFromLine size={18} className="text-orange-500" /> Gestion des retraits
            {list.filter(x => x.status === 'pending').length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                {list.filter(x => x.status === 'pending').length} en attente
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Pour envoyer le virement réel sur le téléphone Orange/MTN du client, cliquez sur <b>⚡ Envoyer Ikeepay</b>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtres de statut */}
          <div className="inline-flex bg-gray-100 p-1 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={cn("px-2.5 py-1 rounded transition", statusFilter === 'pending' ? "bg-white text-orange-700 font-bold shadow-sm" : "text-gray-600 hover:text-gray-900")}
            >
              En attente
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn("px-2.5 py-1 rounded transition", statusFilter === 'all' ? "bg-white text-gray-900 font-bold shadow-sm" : "text-gray-600 hover:text-gray-900")}
            >
              Tous les retraits récents
            </button>
          </div>
          <button onClick={refresh} className="btn-secondary text-sm inline-flex items-center gap-1.5">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>
      </div>

      {/* Configuration du seuil minimum de retrait */}
      <div className="bg-orange-50/60 border-b border-orange-100 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2 text-gray-700">
          <span className="font-medium text-gray-900">Seuil minimum de retrait :</span>
          <span className="font-bold text-orange-700 text-sm bg-white px-2 py-0.5 rounded border border-orange-200">
            {fmt(minWithdrawal)} FCFA
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-gray-500">Modifier :</span>
          <button
            onClick={() => handleSetMin(100)}
            disabled={savingMin || minWithdrawal === 100}
            className={cn("px-2.5 py-1 rounded font-medium border transition", minWithdrawal === 100 ? "bg-orange-600 text-white border-orange-600 shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:bg-orange-50")}
          >
            100 F (Mode Test)
          </button>
          <button
            onClick={() => handleSetMin(2000)}
            disabled={savingMin || minWithdrawal === 2000}
            className={cn("px-2.5 py-1 rounded font-medium border transition", minWithdrawal === 2000 ? "bg-orange-600 text-white border-orange-600 shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:bg-orange-50")}
          >
            2 000 F (Défaut)
          </button>
          <button
            onClick={() => handleSetMin(5000)}
            disabled={savingMin || minWithdrawal === 5000}
            className={cn("px-2.5 py-1 rounded font-medium border transition", minWithdrawal === 5000 ? "bg-orange-600 text-white border-orange-600 shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:bg-orange-50")}
          >
            5 000 F
          </button>
          <button
            onClick={handleCustomMin}
            disabled={savingMin}
            className="px-2.5 py-1 rounded font-medium border bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            title="Saisir un autre montant personnalisé"
          >
            Personnalisé...
          </button>
        </div>
      </div>

      {msg && <div className="mx-4 mt-3 bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm font-medium flex items-center gap-2"><CheckCircle2 size={16} className="text-green-600 shrink-0" />{msg}</div>}
      {error && <div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm font-medium flex items-start gap-2"><AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" /><span className="flex-1">{error}</span></div>}

      {loading ? (
        <div className="p-8 text-center text-gray-400"><Loader2 size={20} className="animate-spin mx-auto mb-2" /> Chargement…</div>
      ) : list.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">
          {statusFilter === 'pending' ? 'Aucun retrait en attente de confirmation.' : 'Aucun retrait enregistré.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Utilisateur</th>
                <th className="px-4 py-3 font-semibold">N° Mobile Money</th>
                <th className="px-4 py-3 font-semibold">Nom du titulaire</th>
                <th className="px-4 py-3 font-semibold text-right">Montant</th>
                <th className="px-4 py-3 font-semibold text-right">Frais</th>
                <th className="px-4 py-3 font-semibold text-right">Net à payer</th>
                <th className="px-4 py-3 font-semibold">Statut & Détails</th>
                <th className="px-4 py-3 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((wr) => {
                const canPayoutOrRefund = wr.status === 'pending' || (wr.status === 'paid' && !wr.providerPayoutId)
                return (
                  <tr key={wr._id} className="border-b border-gray-50 hover:bg-orange-50/40">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{fmtDate(wr.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{wr.user?.name || '—'}</div>
                      <div className="text-xs text-gray-500">{ROLE_LABELS[wr.user?.role] || wr.user?.role || '—'}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono font-semibold text-gray-900 flex items-center gap-1.5"><Phone size={13} className="text-gray-400" /> {wr.momoNumber}</div>
                      <div className="text-xs text-gray-500 uppercase">{OPERATOR_LABELS[wr.momoOperator] || wr.momoOperator || '—'} {wr.country ? `(${wr.country})` : ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 font-medium text-gray-800"><UserIcon size={13} className="text-gray-400" /> {wr.accountName || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">{fmt(wr.amount)} F</td>
                    <td className="px-4 py-3 text-right text-red-500 whitespace-nowrap">− {fmt(wr.fee)} F</td>
                    <td className="px-4 py-3 text-right font-bold text-green-700 whitespace-nowrap">{fmt(wr.netAmount)} {wr.currency || 'XAF'}</td>
                    <td className="px-4 py-3">
                      {wr.status === 'pending' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">En attente</span>}
                      {wr.status === 'paid' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">Payé</span>}
                      {wr.status === 'rejected' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">Rejeté</span>}
                      {wr.providerPayoutId && (
                        <div className="text-[10px] text-green-700 font-mono mt-0.5">Ikeepay: {wr.providerPayoutId}</div>
                      )}
                      {wr.adminNote && (
                        <div className={cn("text-[11px] mt-1 max-w-[220px] leading-tight break-words", wr.adminNote.toLowerCase().includes('échec') || wr.adminNote.toLowerCase().includes('erreur') ? "text-red-700 font-medium bg-red-50 p-1 rounded border border-red-200" : "text-gray-500")}>
                          {wr.adminNote}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {canPayoutOrRefund ? (
                          <>
                            <button
                              onClick={() => handlePayoutIkeepay(wr)}
                              disabled={busyId === wr._id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                              title="Déclencher le virement réel vers le compte Mobile Money du client via Ikeepay"
                            >
                              {busyId === wr._id ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} className="fill-current" />} ⚡ Envoyer Ikeepay
                            </button>
                            <button
                              onClick={() => handleRefund(wr)}
                              disabled={busyId === wr._id}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 disabled:opacity-50"
                              title="Annuler ce retrait et recréditer le portefeuille de l'utilisateur"
                            >
                              <RotateCcw size={12} /> Rembourser
                            </button>
                            <button
                              onClick={() => handleManualPay(wr)}
                              disabled={busyId === wr._id}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                              title="Marquer comme payé manuellement (sans passer par Ikeepay)"
                            >
                              <Check size={12} /> Manuel
                            </button>
                          </>
                        ) : wr.status === 'paid' && wr.providerPayoutId ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 font-semibold bg-green-50 px-2.5 py-1 rounded-lg border border-green-200">
                            <CheckCircle2 size={13} /> Virement Ikeepay terminé
                          </span>
                        ) : wr.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded border border-red-200">
                            <XCircle size={13} /> Rejeté & Remboursé
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function AdminTransactionsPage() {
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [group, setGroup] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pdfRef = useRef(null)

  const key = `/admin/transactions?c=${category}&s=${status}&g=${group}&f=${from}&t=${to}&q=${search}&p=${page}`
  const query = useCachedFetch(
    key,
    async () => walletAdminApi.transactions({ category, status, group, from, to, q: search, page, limit: 50 }),
    [category, status, group, from, to, search, page],
  )

  const data = query.data || {}
  const items = data.transactions || []
  const stats = data.stats || { totalCount: 0, totalIn: 0, totalOut: 0, net: 0, byGroup: { staff: {}, users: {} } }
  const loading = query.loading

  const [approvingId, setApprovingId] = useState(null)

  const refresh = () => { cache.invalidate('/admin/transactions'); query.refetch() }
  const onSearch = (e) => { e.preventDefault(); setPage(1); setSearch(q.trim()) }
  const resetFilters = () => { setCategory(''); setStatus(''); setGroup(''); setFrom(''); setTo(''); setQ(''); setSearch(''); setPage(1) }
  const changeFilter = (setter) => (e) => { setPage(1); setter(e.target.value) }

  const handleApprove = async (id, amount) => {
    if (!window.confirm(`Confirmer et valider manuellement ce paiement de ${fmt(amount)} F ? Le portefeuille sera immédiatement crédité.`)) return
    setApprovingId(id)
    try {
      await walletAdminApi.approvePayment(id)
      refresh()
    } catch (err) {
      alert(err.message || 'Erreur lors de la validation')
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowLeftRight size={22} className="text-indigo-600" /> Gestion des transactions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Toutes les souscriptions et paiements du personnel et des utilisateurs de la plateforme.</p>
        </div>
        <div className="flex items-center gap-2">
          <DownloadPdfButton containerRef={pdfRef} filename="transactions.pdf" title="Transactions de la plateforme" label="Exporter PDF" />
          <button onClick={refresh} className="btn-secondary text-sm inline-flex items-center gap-1.5">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>
      </div>

      <div ref={pdfRef} className="space-y-6">
        {/* Retraits en attente de confirmation admin */}
        <PendingWithdrawals onProcessed={refresh} />

        {/* Cartes de synthèse */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-2 text-green-700"><TrendingUp size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Entrées</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.totalIn)} <span className="text-sm font-medium text-gray-400">XAF</span></div>
            <div className="text-xs text-gray-500 mt-0.5">Total crédité</div>
          </div>
          <div className="card p-4 border-l-4 border-red-400">
            <div className="flex items-center gap-2 text-red-600"><TrendingDown size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Sorties</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.totalOut)} <span className="text-sm font-medium text-gray-400">XAF</span></div>
            <div className="text-xs text-gray-500 mt-0.5">Total débité</div>
          </div>
          <div className="card p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-2 text-blue-600"><Scale size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Solde net</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.net)} <span className="text-sm font-medium text-gray-400">XAF</span></div>
            <div className="text-xs text-gray-500 mt-0.5">Entrées − sorties</div>
          </div>
          <div className="card p-4 border-l-4 border-indigo-500">
            <div className="flex items-center gap-2 text-indigo-600"><Hash size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Transactions</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.totalCount)}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Personnel {fmt(stats.byGroup?.staff?.count)} · Utilisateurs {fmt(stats.byGroup?.users?.count)}
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="card p-4 space-y-3 no-pdf">
          <div className="flex flex-wrap items-center gap-3">
            <select value={category} onChange={changeFilter(setCategory)} className="input text-sm w-auto">
              <option value="">Tous les types</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={status} onChange={changeFilter(setStatus)} className="input text-sm w-auto">
              <option value="">Tous les statuts</option>
              <option value="completed">Effectué</option>
              <option value="approved">Encaissé</option>
              <option value="pending">En attente</option>
              <option value="rejected">Rejeté</option>
              <option value="expired">Expiré</option>
            </select>
            <select value={group} onChange={changeFilter(setGroup)} className="input text-sm w-auto">
              <option value="">Tous les profils</option>
              <option value="staff">Personnel de la plateforme</option>
              <option value="users">Utilisateurs</option>
              <option value="directeur">Directeurs</option>
              <option value="enseignant">Enseignants</option>
              <option value="parent">Parents</option>
              <option value="eleve">Élèves</option>
              <option value="utilisateur">Utilisateurs (simples)</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-gray-500 flex items-center gap-1.5">Du <input type="date" value={from} onChange={changeFilter(setFrom)} className="input text-sm w-auto" /></label>
            <label className="text-xs text-gray-500 flex items-center gap-1.5">Au <input type="date" value={to} onChange={changeFilter(setTo)} className="input text-sm w-auto" /></label>
            <form onSubmit={onSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom, téléphone, matricule, n° compte)…" className="input text-sm flex-1" />
              <button type="submit" className="btn-secondary text-sm">Rechercher</button>
            </form>
            {(category || status || group || from || to || search) && (
              <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-gray-700 underline">Réinitialiser</button>
            )}
          </div>
        </div>

        {/* Tableau */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400"><Loader2 size={24} className="animate-spin mx-auto mb-2" /> Chargement…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-gray-400">Aucune transaction trouvée pour ces filtres.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Personne</th>
                    <th className="px-4 py-3 font-semibold">Profil</th>
                    <th className="px-4 py-3 font-semibold text-right">Montant</th>
                    <th className="px-4 py-3 font-semibold">Statut</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => {
                    const st = STATUS_MAP[t.status] || STATUS_MAP.completed
                    const StIcon = st.icon
                    const isStaff = t.actor?.group === 'staff'
                    const canValidate = t.status === 'pending' && (t.source === 'ikeepay' || t.canApprove || String(t._id).startsWith('p_'))
                    const cleanTargetId = t.rawId || String(t._id).replace(/^p_/, '')
                    return (
                      <tr key={t._id} className="border-b border-gray-50 hover:bg-gray-50/60">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(t.date)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">{t.categoryLabel}</span>
                          {t.withdrawal && (
                            <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                              <div>📱 <span className="font-mono font-semibold">{t.withdrawal.momoNumber}</span>{t.withdrawal.momoOperator && <span className="uppercase"> · {t.withdrawal.momoOperator}</span>}</div>
                              {t.withdrawal.accountName && <div>👤 {t.withdrawal.accountName}</div>}
                              <div>Net à payer : <b className="text-green-700">{fmt(t.withdrawal.netAmount)} F</b> <span className="text-gray-400">(frais 2% : {fmt(t.withdrawal.fee)} F)</span></div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{t.actor?.name || '—'}</div>
                          <div className="text-xs text-gray-500">{ROLE_LABELS[t.actor?.role] || t.actor?.role || '—'}</div>
                          {(t.actor?.phone || t.actor?.matricule || t.actor?.accountNo) && (
                            <div className="text-xs text-gray-400">
                              {t.actor?.phone && <span>📱 {t.actor.phone} </span>}
                              {t.actor?.matricule && <span className="font-mono">· {t.actor.matricule} </span>}
                              {t.actor?.accountNo && <span className="font-mono">· {t.actor.accountNo}</span>}
                            </div>
                          )}
                          {t.counterparty?.name && <div className="text-xs text-gray-400">↔ {t.counterparty.name}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium',
                            isStaff ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600')}>
                            {isStaff ? <Building2 size={12} /> : <Users size={12} />}
                            {isStaff ? 'Personnel' : 'Utilisateur'}
                          </span>
                        </td>
                        <td className={cn('px-4 py-3 text-right font-bold whitespace-nowrap',
                          t.direction === 'debit' ? 'text-red-600' : 'text-green-600')}>
                          {t.direction === 'debit' ? '−' : '+'}{fmt(t.amount)} <span className="text-xs font-medium text-gray-400">{t.currency}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border', st.bg, st.color, st.border)}>
                            <StIcon size={13} /> {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {canValidate && (
                            <button
                              onClick={() => handleApprove(cleanTargetId, t.amount)}
                              disabled={approvingId === cleanTargetId}
                              className="text-xs px-2.5 py-1 inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                              title="Valider manuellement si vous confirmez que les fonds sont sur votre compte Ikeepay"
                            >
                              {approvingId === cleanTargetId ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                              Valider
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {data.pages > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-500 no-pdf">
            <span>{fmt(data.total)} transaction(s) · page {data.page} / {data.pages}</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-secondary text-sm inline-flex items-center gap-1 disabled:opacity-40"><ChevronLeft size={15} /> Préc.</button>
              <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}
                className="btn-secondary text-sm inline-flex items-center gap-1 disabled:opacity-40">Suiv. <ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
