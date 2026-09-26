import { useRef, useState } from 'react'
import {
  Coins, Loader2, RefreshCw, Wallet, Hash, Calculator, ChevronLeft, ChevronRight,
  Users, Building2, CalendarRange, ArrowUpRight, X, AlertCircle, CheckCircle2, Lock,
} from 'lucide-react'
import { walletAdminApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { cn } from '../lib/utils'
import DownloadPdfButton from '../components/DownloadPdfButton'
import { COUNTRIES } from '../constants/countries'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const ROLE_LABELS = {
  super_admin: 'Administrateur', directeur: 'Directeur', enseignant: 'Enseignant',
  parent: 'Parent', eleve: 'Élève', utilisateur: 'Utilisateur', admin: 'Administrateur',
}

// Libellé lisible d'une période (« 2026-07 » → « Juillet 2026 », « 2026-07-11 » → « 11/07/2026 »)
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
function periodLabel(key) {
  if (!key) return '—'
  if (key.length === 7) { const [y, m] = key.split('-'); return `${MONTHS[Number(m) - 1] || m} ${y}` }
  const [y, m, d] = key.split('-'); return `${d}/${m}/${y}`
}

export default function AdminTransactionFeesPage() {
  const [group, setGroup] = useState('')
  const [feeType, setFeeType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [period, setPeriod] = useState('month')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [bannerMsg, setBannerMsg] = useState('')
  const pdfRef = useRef(null)

  const key = `/admin/transaction-fees?g=${group}&ft=${feeType}&f=${from}&t=${to}&per=${period}&q=${search}&p=${page}`
  const query = useCachedFetch(
    key,
    async () => walletAdminApi.transactionFees({ group, feeType, from, to, period, q: search, page, limit: 50 }),
    [group, feeType, from, to, period, search, page],
  )

  const data = query.data || {}
  const fees = data.fees || []
  const stats = data.stats || { totalCount: 0, totalAmount: 0, avg: 0, byGroup: { staff: {}, users: {} }, byType: { transfer: {}, withdrawal: {}, maintenance: {} }, byPeriod: [] }
  const availableBalance = Number(data.availableBalance ?? 0)
  const loading = query.loading

  const refresh = () => { cache.invalidate('/admin/transaction-fees'); query.refetch() }
  const onSearch = (e) => { e.preventDefault(); setPage(1); setSearch(q.trim()) }
  const resetFilters = () => { setGroup(''); setFeeType(''); setFrom(''); setTo(''); setQ(''); setSearch(''); setPage(1) }
  const changeFilter = (setter) => (e) => { setPage(1); setter(e.target.value) }

  const handleWithdrawSuccess = (msg) => {
    setShowWithdrawModal(false)
    setBannerMsg(msg)
    refresh()
    setTimeout(() => setBannerMsg(''), 6000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Coins size={22} className="text-amber-600" /> Frais de transaction
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Frais versés à l'administrateur par le personnel et les utilisateurs de la plateforme.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="btn-primary text-sm inline-flex items-center gap-1.5 shadow-sm bg-amber-600 hover:bg-amber-700 text-white border-none"
          >
            <ArrowUpRight size={16} /> Retirer mes frais
          </button>
          <DownloadPdfButton containerRef={pdfRef} filename="frais-transaction.pdf" title="Frais de transaction encaissés" label="Exporter PDF" />
          <button onClick={refresh} className="btn-secondary text-sm inline-flex items-center gap-1.5">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>
      </div>

      {bannerMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span className="text-sm font-medium">{bannerMsg}</span>
        </div>
      )}

      {/* Bannière solde disponible au retrait Mobile Money */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 rounded-2xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-amber-200 block">Solde disponible au retrait</span>
          <div className="text-3xl font-extrabold mt-1 tracking-tight">
            {fmt(availableBalance)} <span className="text-lg font-medium text-amber-200">XAF</span>
          </div>
          <p className="text-xs text-amber-100 mt-1">
            Frais accumulés prêts à être envoyés directement vers votre compte Mobile Money.
          </p>
        </div>
        <div>
          <button
            onClick={() => setShowWithdrawModal(true)}
            disabled={availableBalance <= 0}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-white text-amber-800 hover:bg-amber-50 disabled:opacity-50 disabled:pointer-events-none transition-colors shadow flex items-center gap-2"
          >
            <ArrowUpRight size={16} /> Retirer vers Mobile Money
          </button>
        </div>
      </div>

      <div ref={pdfRef} className="space-y-6">
        {/* Cartes de synthèse */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 border-l-4 border-amber-500">
            <div className="flex items-center gap-2 text-amber-700"><Wallet size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Total encaissé</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.totalAmount)} <span className="text-sm font-medium text-gray-400">XAF</span></div>
            <div className="text-xs text-gray-500 mt-0.5">Frais versés à l'admin</div>
          </div>
          <div className="card p-4 border-l-4 border-indigo-500">
            <div className="flex items-center gap-2 text-indigo-600"><Hash size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Opérations</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.totalCount)}</div>
            <div className="text-xs text-gray-500 mt-0.5">Frais prélevés</div>
          </div>
          <div className="card p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-2 text-blue-600"><Calculator size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Frais moyen</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.avg)} <span className="text-sm font-medium text-gray-400">XAF</span></div>
            <div className="text-xs text-gray-500 mt-0.5">Par opération</div>
          </div>
          <div className="card p-4 border-l-4 border-emerald-500">
            <div className="flex items-center gap-2 text-emerald-600"><Users size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Par type</span></div>
            <div className="text-sm font-bold text-gray-900 mt-1">Transferts : {fmt(stats.byType?.transfer?.total)} XAF</div>
            <div className="text-sm font-bold text-gray-900">Retraits : {fmt(stats.byType?.withdrawal?.total)} XAF</div>
            <div className="text-sm font-bold text-gray-900">Maintenance : {fmt(stats.byType?.maintenance?.total)} XAF</div>
          </div>
        </div>

        {/* Filtres */}
        <div className="card p-4 space-y-3 no-pdf">
          <div className="flex flex-wrap items-center gap-3">
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
            <select value={feeType} onChange={changeFilter(setFeeType)} className="input text-sm w-auto">
              <option value="">Tous les frais</option>
              <option value="transfer">Frais de transfert (0,25%)</option>
              <option value="withdrawal">Frais de retrait (1%)</option>
              <option value="maintenance">Frais de maintenance</option>
            </select>
            <label className="text-xs text-gray-500 flex items-center gap-1.5">Du <input type="date" value={from} onChange={changeFilter(setFrom)} className="input text-sm w-auto" /></label>
            <label className="text-xs text-gray-500 flex items-center gap-1.5">Au <input type="date" value={to} onChange={changeFilter(setTo)} className="input text-sm w-auto" /></label>
            <select value={period} onChange={changeFilter(setPeriod)} className="input text-sm w-auto">
              <option value="month">Regrouper par mois</option>
              <option value="day">Regrouper par jour</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={onSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom, téléphone, matricule, n° compte)…" className="input text-sm flex-1" />
              <button type="submit" className="btn-secondary text-sm">Rechercher</button>
            </form>
            {(group || feeType || from || to || search) && (
              <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-gray-700 underline">Réinitialiser</button>
            )}
          </div>
        </div>

        {/* Statistiques par période */}
        {stats.byPeriod?.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center gap-2 text-gray-700 mb-3">
              <CalendarRange size={16} className="text-amber-600" />
              <span className="text-sm font-semibold">Total des frais par {period === 'day' ? 'jour' : 'mois'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="px-4 py-2 font-semibold">Période</th>
                    <th className="px-4 py-2 font-semibold text-right">Opérations</th>
                    <th className="px-4 py-2 font-semibold text-right">Montant total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byPeriod.map((p) => (
                    <tr key={p.period} className="border-b border-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{periodLabel(p.period)}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{fmt(p.count)}</td>
                      <td className="px-4 py-2 text-right font-bold text-amber-700">{fmt(p.total)} <span className="text-xs font-medium text-gray-400">XAF</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Détail des frais */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400"><Loader2 size={24} className="animate-spin mx-auto mb-2" /> Chargement…</div>
          ) : fees.length === 0 ? (
            <div className="p-12 text-center text-gray-400">Aucun frais de transaction trouvé pour ces filtres.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Payeur</th>
                    <th className="px-4 py-3 font-semibold">Identifiants</th>
                    <th className="px-4 py-3 font-semibold">Type de frais</th>
                    <th className="px-4 py-3 font-semibold text-right">Base</th>
                    <th className="px-4 py-3 font-semibold text-right">Frais</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map((f) => {
                    const isStaff = f.payer?.group === 'staff'
                    return (
                      <tr key={f._id} className="border-b border-gray-50 hover:bg-gray-50/60">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(f.date)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{f.payer?.name || '—'}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium',
                              isStaff ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600')}>
                              {isStaff ? <Building2 size={11} /> : <Users size={11} />}
                              {ROLE_LABELS[f.payer?.role] || f.payer?.role || '—'}
                            </span>
                          </div>
                          {f.payer?.phone && <div className="text-xs text-gray-400 mt-0.5">📱 {f.payer.phone}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                          {f.payer?.matricule && <div>{f.payer.matricule}</div>}
                          {f.payer?.accountNo && <div>{f.payer.accountNo}</div>}
                          {f.payer?.email && <div className="text-gray-400 font-sans">{f.payer.email}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700">{f.feeLabel}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">{f.baseAmount ? fmt(f.baseAmount) : '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-amber-700 whitespace-nowrap">{fmt(f.amount)} <span className="text-xs font-medium text-gray-400">{f.currency}</span></td>
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
            <span>{fmt(data.total)} frais · page {data.page} / {data.pages}</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-secondary text-sm inline-flex items-center gap-1 disabled:opacity-40"><ChevronLeft size={15} /> Préc.</button>
              <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}
                className="btn-secondary text-sm inline-flex items-center gap-1 disabled:opacity-40">Suiv. <ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </div>

      {showWithdrawModal && (
        <AdminFeeWithdrawModal
          maxAmount={availableBalance}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={handleWithdrawSuccess}
        />
      )}
    </div>
  )
}

function AdminFeeWithdrawModal({ maxAmount, onClose, onSuccess }) {
  const [f, setF] = useState({
    amount: maxAmount > 0 ? String(maxAmount) : '',
    country: 'CM',
    momoOperator: 'mtn',
    momoNumber: '',
    accountName: '',
    pin: '',
    password: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const currentCountry = COUNTRIES.find((c) => c.code === (f.country || 'CM')) || COUNTRIES[0]
  const currentOperators = currentCountry.operators || []

  const up = (key) => (e) => {
    setError('')
    setF({ ...f, [key]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const amt = Number(f.amount)
    if (!amt || amt < 100) {
      setError('Montant minimum : 100 FCFA')
      return
    }
    if (amt > maxAmount) {
      setError(`Le montant dépasse le solde disponible (${fmt(maxAmount)} FCFA)`)
      return
    }
    if (!f.momoNumber.trim()) {
      setError('Veuillez saisir votre numéro Mobile Money')
      return
    }
    if (!f.accountName.trim()) {
      setError('Veuillez saisir le nom du titulaire Mobile Money')
      return
    }
    if (!f.pin.trim() && !f.password.trim()) {
      setError('Veuillez saisir votre code PIN ou votre mot de passe administrateur pour valider le virement')
      return
    }

    setBusy(true)
    try {
      const res = await walletAdminApi.withdrawFees({
        amount: amt,
        momoNumber: f.momoNumber.trim(),
        momoOperator: f.momoOperator,
        accountName: f.accountName.trim(),
        country: f.country || 'CM',
        pin: f.pin.trim() || undefined,
        password: f.password.trim() || undefined,
      })
      onSuccess(res?.message || `Retrait de ${fmt(amt)} FCFA effectué avec succès !`)
    } catch (err) {
      setError(err.message || 'Erreur lors du traitement du retrait')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Coins className="text-amber-600" size={20} />
            <h3 className="font-bold text-gray-900">Retirer mes frais de transaction</h3>
          </div>
          <button onClick={() => !busy && onClose()} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 shadow-sm">
            <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
            <span className="font-medium flex-1">{error}</span>
          </div>
        )}

        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center justify-between">
          <span>Solde de frais disponible :</span>
          <span className="font-bold text-sm text-amber-900">{fmt(maxAmount)} FCFA</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">Montant à retirer (FCFA) *</label>
              {maxAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setF({ ...f, amount: String(maxAmount) })}
                  className="text-xs text-amber-700 hover:underline font-semibold"
                >
                  Tout retirer ({fmt(maxAmount)} F)
                </button>
              )}
            </div>
            <input
              type="number"
              value={f.amount}
              onChange={up('amount')}
              className="input w-full font-bold text-base"
              placeholder="Ex: 50000"
              required
              min={100}
              max={maxAmount}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Pays de réception *</label>
            <select
              value={f.country || 'CM'}
              onChange={(e) => {
                const c = e.target.value
                const cObj = COUNTRIES.find((x) => x.code === c) || COUNTRIES[0]
                setF({
                  ...f,
                  country: c,
                  momoOperator: cObj.operators[0]?.value || 'mtn',
                })
              }}
              className="input w-full font-medium"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Opérateur Mobile Money ({currentCountry.currency}) *</label>
            <select
              value={f.momoOperator}
              onChange={up('momoOperator')}
              className="input w-full"
            >
              {currentOperators.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Numéro Mobile Money *</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-mono font-medium">+{currentCountry.dial}</span>
              <input
                type="tel"
                value={f.momoNumber}
                onChange={up('momoNumber')}
                className="input w-full pl-14"
                placeholder={currentCountry.placeholder}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Nom complet du titulaire Mobile Money *</label>
            <input
              type="text"
              value={f.accountName}
              onChange={up('accountName')}
              className="input w-full"
              placeholder="Ex: Valdes Lando"
              required
            />
          </div>

          <div className="border-t border-gray-100 pt-3">
            <label className="text-xs font-medium text-gray-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1"><Lock size={12} className="text-amber-600" /> Code PIN ou Mot de passe admin *</span>
            </label>
            <input
              type="password"
              value={f.pin || f.password}
              onChange={(e) => setF({ ...f, pin: e.target.value, password: e.target.value })}
              className="input w-full"
              placeholder="••••••••"
              required
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Renseignez votre code PIN portefeuille ou votre mot de passe administrateur pour autoriser ce virement.
            </p>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full justify-center py-3 text-sm bg-amber-600 hover:bg-amber-700 text-white border-none shadow"
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Envoi du virement vers Mobile Money...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ArrowUpRight size={16} /> Confirmer le retrait de {f.amount ? fmt(f.amount) : '...'} FCFA
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
