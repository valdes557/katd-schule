import { useRef, useState } from 'react'
import {
  UserCog, Loader2, RefreshCw, Wallet, Users, Building2, Smartphone,
  ChevronLeft, ChevronRight, Ban, CheckCircle2, Trash2, Circle, PlusCircle, Power, PowerOff, X,
} from 'lucide-react'
import { adminUsersApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { cn } from '../lib/utils'
import DownloadPdfButton from '../components/DownloadPdfButton'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'

const ROLE_LABELS = {
  super_admin: 'Administrateur', directeur: 'Directeur', enseignant: 'Enseignant',
  parent: 'Parent', eleve: 'Élève', utilisateur: 'Utilisateur', admin: 'Administrateur',
}
const OPERATOR_LABELS = { mtn: 'MTN MoMo', moov: 'Moov Money', celtiis: 'Celtiis Cash', orange: 'Orange Money' }

export default function AdminUsersPage() {
  const [role, setRole] = useState('')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [acting, setActing] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [fundingUser, setFundingUser] = useState(null)
  const [fundAmount, setFundAmount] = useState('')
  const [fundReason, setFundReason] = useState('')
  const [togglingFunding, setTogglingFunding] = useState(false)
  const pdfRef = useRef(null)

  const key = `/admin/users?r=${role}&q=${search}&p=${page}`
  const query = useCachedFetch(
    key,
    async () => adminUsersApi.list({ role, q: search, page, limit: 50 }),
    [role, search, page],
  )

  const data = query.data || {}
  const users = data.users || []
  const stats = data.stats || { totalUsers: 0, totalBalance: 0, onlineCount: 0, blockedCount: 0 }
  const userFundingEnabled = data.userFundingEnabled !== false
  const loading = query.loading

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const refresh = () => { cache.invalidate('/admin/users'); query.refetch() }
  const onSearch = (e) => { e.preventDefault(); setPage(1); setSearch(q.trim()) }
  const resetFilters = () => { setRole(''); setQ(''); setSearch(''); setPage(1) }

  const toggleBlock = async (u) => {
    setErr('')
    setActing(u._id)
    try {
      await adminUsersApi.block(u._id, u.isActive) // isActive=true → on bloque (blocked=true)
      flash(u.isActive ? `${u.name} a été bloqué.` : `${u.name} a été débloqué.`)
      refresh()
    } catch (e) { setErr(e.message) } finally { setActing('') }
  }

  const remove = async (u) => {
    if (!window.confirm(`Supprimer définitivement le compte et les données personnelles de ${u.name} (${u.email}) ? Les écritures comptables passées restent conservées pour l'audit. Cette action est irréversible.`)) return
    setErr('')
    setActing(u._id)
    try {
      await adminUsersApi.remove(u._id)
      flash(`${u.name} et ses données personnelles ont été supprimés.`)
      refresh()
    } catch (e) { setErr(e.message) } finally { setActing('') }
  }

  const toggleFundingFeature = async () => {
    const next = !userFundingEnabled
    const confirmMsg = next
      ? "Réactiver le système d'approvisionnement des portefeuilles utilisateurs ?"
      : "Désactiver / retirer le système d'approvisionnement des portefeuilles utilisateurs ? (Note : l'historique comptable des transactions passées reste conservé pour la traçabilité.)"
    if (!window.confirm(confirmMsg)) return
    setErr('')
    setTogglingFunding(true)
    try {
      const res = await adminUsersApi.toggleFundingFeature(next)
      flash(res.message || (next ? "Approvisionnement activé." : "Approvisionnement désactivé."))
      refresh()
    } catch (e) { setErr(e.message) } finally { setTogglingFunding(false) }
  }

  const submitFund = async (e) => {
    e.preventDefault()
    if (!fundingUser) return
    const amt = Math.round(Number(fundAmount))
    if (!Number.isFinite(amt) || amt < 100) {
      setErr('Veuillez saisir un montant valide (minimum 100 F).')
      return
    }
    setErr('')
    setActing(fundingUser._id)
    try {
      const res = await adminUsersApi.fund(fundingUser._id, amt, fundReason.trim())
      flash(res.message || `Portefeuille de ${fundingUser.name} crédité de ${fmt(amt)} F.`)
      setFundingUser(null)
      setFundAmount('')
      setFundReason('')
      refresh()
    } catch (e) { setErr(e.message) } finally { setActing('') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UserCog size={22} className="text-indigo-600" /> Gestion des utilisateurs
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Tous les comptes de la plateforme : soldes, comptes externes, blocage et suppression.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={toggleFundingFeature}
            disabled={togglingFunding}
            className={cn(
              'text-sm inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium border transition disabled:opacity-40',
              userFundingEnabled
                ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
            )}
          >
            {togglingFunding ? <Loader2 size={15} className="animate-spin" /> : (userFundingEnabled ? <PowerOff size={15} /> : <Power size={15} />)}
            {userFundingEnabled ? "Retirer l'approvisionnement" : "Activer l'approvisionnement"}
          </button>
          <DownloadPdfButton containerRef={pdfRef} filename="utilisateurs.pdf" title="Utilisateurs de la plateforme" label="Exporter PDF" />
          <button onClick={refresh} className="btn-secondary text-sm inline-flex items-center gap-1.5">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm">{msg}</div>}
      {err && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{err}</div>}

      <div ref={pdfRef} className="space-y-6">
        {/* Cartes de synthèse */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 border-l-4 border-indigo-500">
            <div className="flex items-center gap-2 text-indigo-600"><Users size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Utilisateurs</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.totalUsers)}</div>
            <div className="text-xs text-gray-500 mt-0.5">Comptes au total</div>
          </div>
          <div className="card p-4 border-l-4 border-emerald-500">
            <div className="flex items-center gap-2 text-emerald-600"><Wallet size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Solde total</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.totalBalance)} <span className="text-sm font-medium text-gray-400">XAF</span></div>
            <div className="text-xs text-gray-500 mt-0.5">Somme de tous les soldes</div>
          </div>
          <div className="card p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-2 text-green-600"><Circle size={16} className="fill-green-500 text-green-500" /><span className="text-xs font-semibold uppercase tracking-wide">En ligne</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.onlineCount)}</div>
            <div className="text-xs text-gray-500 mt-0.5">Actifs (&lt; 3 min)</div>
          </div>
          <div className="card p-4 border-l-4 border-red-500">
            <div className="flex items-center gap-2 text-red-600"><Ban size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Bloqués</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.blockedCount)}</div>
            <div className="text-xs text-gray-500 mt-0.5">Comptes désactivés</div>
          </div>
        </div>

        {/* Filtres */}
        <div className="card p-4 space-y-3 no-pdf">
          <div className="flex flex-wrap items-center gap-3">
            <select value={role} onChange={(e) => { setPage(1); setRole(e.target.value) }} className="input text-sm w-auto">
              <option value="">Tous les rôles</option>
              <option value="directeur">Directeurs</option>
              <option value="enseignant">Enseignants</option>
              <option value="parent">Parents</option>
              <option value="eleve">Élèves</option>
              <option value="utilisateur">Utilisateurs</option>
              <option value="super_admin">Administrateurs</option>
            </select>
            <form onSubmit={onSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom, email, téléphone, matricule, n° compte)…" className="input text-sm flex-1" />
              <button type="submit" className="btn-secondary text-sm">Rechercher</button>
            </form>
            {(role || search) && <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-gray-700 underline">Réinitialiser</button>}
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400"><Loader2 size={24} className="animate-spin mx-auto mb-2" /> Chargement…</div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-gray-400">Aucun utilisateur trouvé pour ces filtres.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="px-4 py-3 font-semibold">Utilisateur</th>
                    <th className="px-4 py-3 font-semibold">Identifiants</th>
                    <th className="px-4 py-3 font-semibold text-right">Solde</th>
                    <th className="px-4 py-3 font-semibold">Compte externe</th>
                    <th className="px-4 py-3 font-semibold">Statut</th>
                    <th className="px-4 py-3 font-semibold text-right no-pdf">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 flex items-center gap-1.5">
                          {u.isOnline && <span title="En ligne" className="w-2 h-2 rounded-full bg-green-500 inline-block" />}
                          {u.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-600">
                            <Building2 size={11} /> {ROLE_LABELS[u.role] || u.role}
                          </span>
                          {u.school && <span className="text-xs text-gray-400">{u.school}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <div className="text-gray-600">{u.email}</div>
                        {u.phone && <div>📱 {u.phone}</div>}
                        <div className="font-mono text-gray-400">{u.matricule || ''} {u.walletAccountNo || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                        {fmt(u.balance)} <span className="text-xs font-medium text-gray-400">F</span>
                        {u.locked > 0 && <div className="text-[11px] font-normal text-amber-600">+ {fmt(u.locked)} bloqué</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {u.externalAccount?.number ? (
                          <div className="text-gray-600">
                            <div className="flex items-center gap-1"><Smartphone size={12} className="text-gray-400" /> {OPERATOR_LABELS[u.externalAccount.operator] || u.externalAccount.operator || 'MoMo'}</div>
                            <div className="font-mono">{u.externalAccount.number}</div>
                            {u.externalAccount.name && <div className="text-gray-400">{u.externalAccount.name}</div>}
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {u.isActive
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-green-50 text-green-600"><CheckCircle2 size={11} /> Actif</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-600"><Ban size={11} /> Bloqué</span>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap no-pdf">
                        <div className="inline-flex items-center gap-1.5">
                          {userFundingEnabled && (
                            <button
                              onClick={() => { setErr(''); setFundingUser(u); setFundAmount(''); setFundReason('') }}
                              disabled={acting === u._id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                            >
                              <PlusCircle size={12} /> Approvisionner
                            </button>
                          )}
                          {u.role !== 'super_admin' && (
                            <>
                              <button onClick={() => toggleBlock(u)} disabled={acting === u._id}
                                className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium disabled:opacity-40',
                                  u.isActive ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100')}>
                                {acting === u._id ? <Loader2 size={12} className="animate-spin" /> : (u.isActive ? <Ban size={12} /> : <CheckCircle2 size={12} />)}
                                {u.isActive ? 'Bloquer' : 'Débloquer'}
                              </button>
                              <button onClick={() => remove(u)} disabled={acting === u._id}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40">
                                <Trash2 size={12} /> Supprimer
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {data.pages > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-500 no-pdf">
            <span>{fmt(data.total)} utilisateurs · page {data.page} / {data.pages}</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-secondary text-sm inline-flex items-center gap-1 disabled:opacity-40"><ChevronLeft size={15} /> Préc.</button>
              <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}
                className="btn-secondary text-sm inline-flex items-center gap-1 disabled:opacity-40">Suiv. <ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </div>

      {fundingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-gray-900">Approvisionner le portefeuille</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {fundingUser.name} ({fundingUser.email}) — Solde actuel : <strong className="text-emerald-700">{fmt(fundingUser.balance)} F</strong>
                </p>
              </div>
              <button onClick={() => setFundingUser(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitFund} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Montant (XAF)</label>
                <input
                  type="number"
                  min={100}
                  max={50000000}
                  step={50}
                  required
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="Ex : 6000"
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Motif (optionnel)</label>
                <input
                  type="text"
                  maxLength={200}
                  value={fundReason}
                  onChange={(e) => setFundReason(e.target.value)}
                  placeholder="Ex : Approvisionnement manuel administrateur"
                  className="input w-full text-sm"
                />
              </div>
              <p className="text-[11px] text-gray-400">
                L'opération est enregistrée dans le journal comptable (WalletTransaction) avec votre identité d'administrateur.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setFundingUser(null)} className="btn-secondary text-sm">
                  Annuler
                </button>
                <button type="submit" disabled={acting === fundingUser._id} className="btn-primary text-sm inline-flex items-center gap-1.5">
                  {acting === fundingUser._id && <Loader2 size={14} className="animate-spin" />}
                  Créditer le portefeuille
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
