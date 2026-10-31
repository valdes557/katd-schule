// pages/user/UserShareholdersPage.jsx — Programme associés (espace utilisateur /u).
// Au clic sur le bouton « Actions » ou « Associés » : un POP-UP présente les plans par zone
// (arrondissement / régional / national / international / mondial) avec badge PROMO (10% max alloués).
// Dès que les 10% sont atteints, le système bloque la souscription jusqu'à nouvel ordre.
// Après validation du paiement, l'utilisateur est orienté vers son PORTEFEUILLE
// D'ASSOCIÉ : utilisateurs de sa zone, transactions (agrégats uniquement — jamais
// les montants individuels ni les soldes des autres), frais, ses gains, et les
// publications du super admin (dépenses, sommes à payer, réunions…).
import { useState, useEffect } from 'react'
import {
  Landmark, Loader2, X, CheckCircle2, MapPin, Users, ArrowLeftRight, Coins,
  TrendingUp, RefreshCw, Crown, Megaphone, CalendarClock, Video, Banknote, Receipt, Wallet,
  Lock, Sparkles, AlertCircle, ShieldAlert, Smartphone, History,
} from 'lucide-react'
import { shareholdersApi, paymentsApi, walletApi, zonesApi } from '../../lib/api'
import SavedMomoSelector from '../../components/SavedMomoSelector'
import { useInlineCheckout } from '../../components/payments/useInlineCheckout'

const fmt = (n, maxDecimals = 4) => {
  const num = Number(n) || 0
  return num.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  })
}
const OPERATORS = [
  { value: 'mtn', label: 'MTN Mobile Money' },
  { value: 'orange', label: 'Orange Money' },
]
const ZONE_LABELS = {
  arrondissement: "Nom de l'arrondissement",
  regional: 'Nom de la région',
  national: 'Pays',
  international: 'Zone internationale (optionnel)',
  mondial: 'Couverture mondiale (global)',
}
const PLAN_GRADIENTS = {
  arrondissement: 'from-emerald-500 to-teal-600',
  regional: 'from-blue-500 to-indigo-600',
  national: 'from-amber-500 to-orange-600',
  international: 'from-purple-600 to-fuchsia-600',
  mondial: 'from-rose-600 via-pink-600 to-purple-700',
}

const ALL_FEE_CATALOG = [
  { key: 'subscription', label: "Souscriptions d'écoles", desc: "Licences et abonnements annuels des établissements scolaires" },
  { key: 'transfer_fee', label: "Transferts d'argent", desc: "Frais de transferts P2P entre utilisateurs de la plateforme" },
  { key: 'withdrawal_fee', label: "Retraits Mobile Money", desc: "Commissions sur les retraits vers MTN et Orange Money" },
  { key: 'collect_fee', label: "Collecte mensuelle", desc: "Frais de tenue de compte mensuels (1 000 FCFA) sur les collectes" },
  { key: 'client_signup', label: "Souscription client collecte", desc: "Frais d'adhésion client d'épargne journalière (4 995 FCFA)" },
  { key: 'agent_signup', label: "Ouverture compte agent", desc: "Frais d'activation des agences et points de collecte (4 800 FCFA)" },
  { key: 'merchant_signup', label: "Ouverture compte Marchand", desc: "Frais d'adhésion et intégration des commerces partenaires" },
  { key: 'shareholder_subscription', label: "Souscription des associés", desc: "Revenus issus des parts d'actions souscrites sur la plateforme" },
  { key: 'ai_subscription', label: "Souscription IA", desc: "Crédits et souscriptions aux fonctionnalités d'intelligence artificielle" },
  { key: 'maintenance_fee', label: "Maintenance système", desc: "Frais généraux d'infrastructure et de maintenance de la plateforme" },
]
const POST_META = {
  depense: { label: 'Dépense', icon: Receipt, cls: 'bg-orange-100 text-orange-700' },
  paiement: { label: 'Somme à payer', icon: Banknote, cls: 'bg-red-100 text-red-700' },
  reunion: { label: 'Réunion', icon: CalendarClock, cls: 'bg-blue-100 text-blue-700' },
  info: { label: 'Info', icon: Megaphone, cls: 'bg-gray-100 text-gray-600' },
}

export default function UserShareholdersPage() {
  const [cfg, setCfg] = useState(null)
  const [dash, setDash] = useState(null)          // portefeuille associé (403 si pas associé)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [err, setErr] = useState('')
  const [showPlans, setShowPlans] = useState(false) // pop-up des plans

  const load = async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    else setRefreshing(true)
    try {
      const c = await shareholdersApi.config()
      setCfg(c)
      try {
        const d = await shareholdersApi.dashboard()
        setDash(d)
        setShowPlans(false)
      } catch {
        // Pas encore associé → le pop-up des plans s'ouvre directement
        setDash(null)
        setShowPlans(true)
      }
    } catch (e) { setErr(e.message) } finally {
      if (showSpinner) setLoading(false)
      else setRefreshing(false)
    }
  }

  useEffect(() => {
    load(true)
    // Synchronisation en arrière-plan toutes les 25 secondes des transactions et nouveaux utilisateurs de la zone
    const timer = setInterval(() => {
      load(false)
    }, 25000)
    return () => clearInterval(timer)
  }, [])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" /></div>

  const isSoldOut = !!cfg?.promo?.isSoldOut

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="text-indigo-600" size={26} />
          <h1 className="text-xl font-bold text-gray-900">{dash ? "Portefeuille d'associé" : 'Associés'}</h1>
        </div>
        {dash && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load(false)}
              disabled={refreshing}
              className="btn-ghost text-xs border border-gray-200 flex items-center gap-1.5 hover:bg-gray-50 active:scale-95"
              title="Actualiser les transactions et utilisateurs en direct"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-indigo-600' : 'text-gray-500'} />
              <span>Actualiser</span>
            </button>
            <button
              onClick={() => setShowPlans(true)}
              disabled={isSoldOut}
              className={`btn-ghost text-xs border border-gray-200 ${isSoldOut ? 'opacity-60 cursor-not-allowed' : ''}`}
              title={isSoldOut ? 'Souscriptions bloquées (quota 10% atteint)' : 'Souscrire d\'autres parts'}
            >
              {isSoldOut ? '🔒 Plans fermés' : 'Autres plans'}
            </button>
          </div>
        )}
      </div>

      {/* Bannière d'alerte PROMO 10% */}
      {cfg?.promo && (
        <div className={`rounded-2xl p-4 shadow-sm border ${
          isSoldOut
            ? 'bg-red-50 border-red-200 text-red-900'
            : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white'
        }`}>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
              isSoldOut ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-white/20 text-white backdrop-blur-xs'
            }`}>
              {isSoldOut ? <><Lock size={11} /> PROMO 10% CLÔTURÉE</> : <><Sparkles size={11} /> PROMO OFFRE LIMITÉE</>}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              isSoldOut ? 'bg-red-200 text-red-800' : 'bg-white text-orange-700 shadow-2xs'
            }`}>
              {isSoldOut ? '10% / 10% atteints' : `Reste ${cfg.promo.remainingPercent}% sur 10%`}
            </span>
          </div>
          <p className="text-xs sm:text-sm font-bold">
            {isSoldOut
              ? "Le quota de 10% d'actions allouées est entièrement souscrit. La section souscription est verrouillée jusqu'à nouvel ordre."
              : "Prix des actions en promotion — 10% d'actions allouées seulement sur la plateforme !"}
          </p>
          <div className="mt-2 space-y-1">
            <div className={`w-full rounded-full h-2 overflow-hidden ${isSoldOut ? 'bg-red-200' : 'bg-black/20'}`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${isSoldOut ? 'bg-red-600' : 'bg-white'}`}
                style={{ width: `${Math.min(100, Math.max(5, (cfg.promo.totalSubscribed / 10) * 100))}%` }}
              />
            </div>
            <div className={`flex justify-between text-[10px] font-semibold ${isSoldOut ? 'text-red-700' : 'text-white/90'}`}>
              <span>{cfg.promo.totalSubscribed}% déjà attribués</span>
              <span>Plafond : 10% max</span>
            </div>
          </div>
        </div>
      )}

      {err && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{err}</div>}

      {dash ? <ShareholderWallet dash={dash} onRefresh={load} /> : (
        !showPlans && (
          <div className="text-center py-16 text-gray-400">
            <Landmark size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Vous n'êtes pas encore associé.</p>
            {!isSoldOut ? (
              <button onClick={() => setShowPlans(true)} className="btn-primary mt-4 mx-auto">Voir les plans d'associé</button>
            ) : (
              <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
                <Lock size={13} /> Les souscriptions sont actuellement fermées (quota 10% atteint).
              </div>
            )}
          </div>
        )
      )}

      {showPlans && cfg && (
        <PlansPopup
          cfg={cfg}
          ownedKeys={new Set((dash?.shareholdings || []).map((s) => s.planKey))}
          onClose={() => setShowPlans(false)}
          onDone={async () => { setShowPlans(false); await load() }}
        />
      )}
    </div>
  )
}

// ── Portefeuille d'associé ──
// CONFIDENTIALITÉ : uniquement des agrégats — pas de transferts individuels ni de soldes.
function ShareholderWallet({ dash, onRefresh }) {
  const { stats = {}, zone = {}, posts = [], shareholdings = [], withdrawals = [] } = dash || {}
  const activeHoldings = Array.isArray(shareholdings) ? shareholdings : []
  const primaryHolding = activeHoldings[0] || {}
  const currentPercent = primaryHolding.percent || 1
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const availableFees = stats?.availableFeesBalance != null
    ? stats.availableFeesBalance
    : Math.max(0, (stats?.shareholderCalculatedShare || 0) - (stats?.totalFeesWithdrawn || 0))
  const totalFeesEarned = stats?.totalFeesEarned != null
    ? stats.totalFeesEarned
    : (stats?.shareholderCalculatedShare || 0)
  const totalWithdrawn = stats?.totalFeesWithdrawn || 0

  return (
    <div className="space-y-5">
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span className="text-xs font-bold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700 p-1">
            <X size={15} />
          </button>
        </div>
      )}
      {/* Zone d'attribution */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-2 opacity-90"><Crown size={16} /><span className="text-xs font-semibold uppercase">Zone d'attribution</span></div>
        <p className="text-xl font-bold mt-1">{zone?.label || zone?.planKey || "Zone d'attribution"}</p>
        {zone?.zone && <p className="text-sm opacity-85 flex items-center gap-1 mt-0.5"><MapPin size={13} /> {zone.zone}</p>}
        <div className="flex flex-wrap gap-2 mt-3">
          {activeHoldings.map((s) => (
            <span key={s._id || s.planKey} className="text-[10px] font-semibold bg-white/20 rounded-full px-2.5 py-1">
              {s.planLabel || s.planKey} · {s.percent}% · jusqu'au {s.endAt ? new Date(s.endAt).toLocaleDateString('fr-FR') : '—'}
            </span>
          ))}
        </div>
      </div>

      {/* Statistiques agrégées de la zone */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Users} color="text-blue-600" border="border-blue-500" label="Utilisateurs de la zone" value={fmt(stats?.userCount)} />
        <StatCard icon={ArrowLeftRight} color="text-indigo-600" border="border-indigo-500" label="Transactions effectuées" value={fmt(stats?.txCount || 0)} />
        <StatCard icon={Wallet} color="text-amber-600" border="border-amber-500" label="Transferts et retraits de frais" value={fmt(stats?.movementsTotal || 0) + ' F'} />
        <StatCard icon={Coins} color="text-emerald-600" border="border-emerald-500" label="Frais de transactions" value={fmt(stats?.feesTotal || 0) + ' F'} />
      </div>

      {/* Section des droits de perception sur les frais plateforme */}
      <div className="bg-white rounded-2xl border border-gray-150 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2 text-indigo-700">
            <Landmark size={20} />
            <div>
              <h3 className="text-sm font-bold text-gray-900">Droits de Perception & Répartition des Frais</h3>
              <p className="text-[11px] text-gray-500">Frais de plateforme attribués à votre palier d'associé</p>
            </div>
          </div>
          <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-xl">
            Part active : {currentPercent}%
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
            <span className="text-[10px] text-gray-400 uppercase font-bold block">Revenus plateforme éligibles</span>
            <span className="text-lg font-black text-gray-900">{fmt(stats?.eligiblePlatformFees || 0)} FCFA</span>
            <p className="text-[10px] text-gray-500">Cumul sur les catégories de frais de votre plan</p>
          </div>
          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
            <span className="text-[10px] text-emerald-700 uppercase font-bold block">Votre quote-part théorique</span>
            <span className="text-lg font-black text-emerald-800">{fmt(stats?.shareholderCalculatedShare || 0)} FCFA</span>
            <p className="text-[10px] text-emerald-600 font-semibold">{currentPercent}% de vos frais attribués</p>
          </div>
        </div>

        {/* Détail ventilé par catégorie de frais */}
        {Array.isArray(dash?.categoryBreakdown) && dash.categoryBreakdown.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800 block">Détail des frais par catégorie :</span>
              <span className="text-[10px] text-gray-500 font-semibold">
                {dash.categoryBreakdown.filter((x) => x.isAllowed).length} / {dash.categoryBreakdown.length} flux rémunérés
              </span>
            </div>
            <div className="text-[11px] text-gray-600 bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 flex items-center gap-2">
              <Sparkles size={14} className="text-amber-500 shrink-0" />
              <span>
                <b>Transparence garantie :</b> Vos quote-parts sont immédiatement calculées et créditées sur chaque opération effectuée par les utilisateurs enregistrés dans votre zone d'attribution.
              </span>
            </div>
            <div className="overflow-x-auto border border-gray-150 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold">
                  <tr>
                    <th className="py-2 px-3">Type de Frais</th>
                    <th className="py-2 px-3 text-center">Éligibilité</th>
                    <th className="py-2 px-3 text-right">Total Plateforme</th>
                    <th className="py-2 px-3 text-right">Votre Part ({currentPercent}%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dash.categoryBreakdown.map((item) => (
                    <tr key={item.key} className={item.isAllowed ? 'bg-white' : 'bg-gray-50/50 opacity-60'}>
                      <td className="py-2 px-3">
                        <span className="font-bold text-gray-800 block">{item.label}</span>
                        {item.desc && <span className="text-[10px] text-gray-400 block line-clamp-1">{item.desc}</span>}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          item.isAllowed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'
                        }`}>
                          {item.isAllowed ? 'Bénéficiaire' : 'Exclu du palier'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-gray-700">
                        {fmt(item.totalRevenue)} F
                      </td>
                      <td className="py-2 px-3 text-right font-extrabold text-emerald-700">
                        {item.isAllowed ? `${fmt(item.shareholderShare)} F` : '0 F'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Opérations rémunérées des utilisateurs de la zone */}
      <div className="bg-white rounded-2xl border border-gray-150 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <TrendingUp size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                Opérations Rémunérées de votre Zone
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  {dash?.zoneOperations?.length || 0} opération{(dash?.zoneOperations?.length || 0) > 1 ? 's' : ''}
                </span>
              </h3>
              <p className="text-[11px] text-gray-500">
                Suivi en direct de chaque opération réalisée par les utilisateurs attribués à votre zone avec votre quote-part ({currentPercent}%)
              </p>
            </div>
          </div>
        </div>

        {Array.isArray(dash?.zoneOperations) && dash.zoneOperations.length > 0 ? (
          <div className="overflow-x-auto border border-gray-150 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap">Date & Heure</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Utilisateur</th>
                  <th className="py-2.5 px-3">Nature de l'Opération</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Montant Opération</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Frais Plateforme</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Taux Associé</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Votre Quote-part</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dash.zoneOperations.map((op) => (
                  <tr key={op.id || op.date} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="py-2.5 px-3 text-[11px] text-gray-600 whitespace-nowrap font-medium">
                      {new Date(op.date).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-bold text-gray-900 block">{op.userName || 'Utilisateur'}</span>
                      {op.userEmail && <span className="text-[10px] text-gray-400 block">{op.userEmail}</span>}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 font-semibold text-gray-800 text-xs">
                        {op.categoryLabel || op.categoryKey}
                      </span>
                      {op.description && (
                        <span className="text-[10px] text-gray-500 block line-clamp-1">{op.description}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-gray-700 whitespace-nowrap">
                      {fmt(op.operationAmount)} FCFA
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-900 whitespace-nowrap">
                      {fmt(op.platformFee)} FCFA
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                        {op.shareholderPercent}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-emerald-700 whitespace-nowrap text-sm">
                      +{fmt(op.shareholderShare)} FCFA
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-emerald-50/60 border-t border-emerald-100 font-bold">
                <tr>
                  <td colSpan={4} className="py-2 px-3 text-emerald-900 font-extrabold text-xs">
                    Total quote-parts générées par les utilisateurs de votre zone :
                  </td>
                  <td className="py-2 px-3 text-right text-emerald-950 font-black">
                    {fmt(stats?.eligiblePlatformFees || 0)} FCFA
                  </td>
                  <td className="py-2 px-3 text-center text-emerald-900 font-extrabold">
                    {currentPercent}%
                  </td>
                  <td className="py-2 px-3 text-right text-emerald-800 font-black text-sm">
                    {fmt(stats?.shareholderCalculatedShare || 0)} FCFA
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Coins size={28} className="mx-auto mb-2 opacity-40 text-emerald-600" />
            <p className="text-xs font-semibold text-gray-600">Aucune opération rémunérée enregistrée pour le moment</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Toute opération effectuée par les utilisateurs de votre zone apparaîtra immédiatement ici avec votre quote-part ({currentPercent}%).
            </p>
          </div>
        )}
      </div>

      {/* Retraits & Virements des Frais d'Associé */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <Banknote size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                Retrait & Virement des Frais d'Associé
                <span className="text-[10px] bg-white/20 font-extrabold px-2 py-0.5 rounded-full">Portefeuille & MoMo</span>
              </h3>
              <p className="text-[11px] text-emerald-100">Virement instantané vers votre portefeuille Katd-Schüle ou retrait Mobile Money</p>
            </div>
          </div>
          <button
            onClick={() => setShowWithdrawModal(true)}
            disabled={availableFees <= 0}
            className={`px-4 py-2.5 rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-2 ${
              availableFees > 0
                ? 'bg-white text-emerald-800 hover:bg-emerald-50 active:scale-95 cursor-pointer ring-2 ring-white/50'
                : 'bg-white/30 text-white/70 cursor-not-allowed opacity-60'
            }`}
          >
            <Banknote size={16} /> Effectuer un retrait
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-white/10 rounded-xl p-3.5 backdrop-blur-xs border border-white/10 space-y-0.5">
            <span className="text-[10px] text-emerald-100 uppercase font-semibold block">Total frais imputés</span>
            <span className="text-base font-black text-white block">{fmt(totalFeesEarned)} FCFA</span>
          </div>
          <div className="bg-white/10 rounded-xl p-3.5 backdrop-blur-xs border border-white/10 space-y-0.5">
            <span className="text-[10px] text-emerald-100 uppercase font-semibold block">Frais déjà retirés</span>
            <span className="text-base font-black text-white block">{fmt(totalWithdrawn)} FCFA</span>
          </div>
          <div className="bg-white/25 rounded-xl p-3.5 backdrop-blur-xs border border-white/30 space-y-0.5">
            <span className="text-[10px] text-amber-200 uppercase font-black block">Solde retirable disponible</span>
            <span className="text-lg font-black text-white block">{fmt(availableFees)} FCFA</span>
          </div>
        </div>
      </div>

      {/* Historique des retraits d'associé */}
      {Array.isArray(withdrawals) && withdrawals.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-150 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 text-gray-800 font-bold text-xs">
            <History size={16} className="text-emerald-600" />
            <span>Historique de mes retraits & virements de frais</span>
          </div>
          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-semibold">
                <tr>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Destination</th>
                  <th className="py-2 px-3 text-right">Montant brut</th>
                  <th className="py-2 px-3 text-right">Frais</th>
                  <th className="py-2 px-3 text-right">Net crédité / perçu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {withdrawals.map((w) => (
                  <tr key={w._id}>
                    <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                      {new Date(w.createdAt).toLocaleDateString('fr-FR')} {new Date(w.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 px-3">
                      {w.meta?.targetMethod === 'wallet' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-[10px]">
                          <Wallet size={12} /> Portefeuille Katd-Schüle
                        </span>
                      ) : (
                        <>
                          <span className="font-bold text-gray-800 block uppercase text-[11px]">
                            {w.meta?.momoOperator || 'MOMO'} · {w.meta?.momoNumber || '—'}
                          </span>
                          {w.meta?.accountName && <span className="text-[10px] text-gray-400 block">{w.meta.accountName}</span>}
                        </>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-gray-700">{fmt(w.amount)} F</td>
                    <td className="py-2 px-3 text-right text-gray-400">
                      {w.meta?.targetMethod === 'wallet' ? '0 F (Gratuit)' : `${fmt(w.meta?.fee || 0)} F`}
                    </td>
                    <td className="py-2 px-3 text-right font-extrabold text-emerald-700">{fmt(w.meta?.netAmount || w.amount)} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showWithdrawModal && (
        <ShareholderWithdrawModal
          availableBalance={availableFees}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={(msg) => {
            setSuccessMsg(msg)
            if (typeof onRefresh === 'function') onRefresh()
          }}
        />
      )}

      {/* Gains accumulés */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-600">
          <TrendingUp size={18} />
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Mes dividendes versés sur portefeuille</p>
            <p className="text-[11px] text-gray-400">{fmt(stats?.gainsCount)} versement{(stats?.gainsCount || 0) > 1 ? 's' : ''} reçu{(stats?.gainsCount || 0) > 1 ? 's' : ''}</p>
          </div>
        </div>
        <p className="text-2xl font-bold text-emerald-600">{fmt(stats?.gainsTotal)} <span className="text-sm">F</span></p>
      </div>

      {/* Publications du super admin */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Megaphone size={16} className="text-indigo-600" />
          <h2 className="font-semibold text-gray-900 text-sm">Publications de l'administration pour les associés</h2>
        </div>
        <div className="divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">
          {(posts || []).length === 0 && <p className="p-6 text-center text-sm text-gray-400">Aucune publication pour le moment.</p>}
          {(posts || []).map((p) => {
            const m = POST_META[p.category] || POST_META.info
            const Icon = m.icon
            return (
              <div key={p._id} className="p-4 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${m.cls}`}><Icon size={11} /> {m.label}</span>
                  <span className="text-[11px] text-gray-400">{new Date(p.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
                <p className="font-semibold text-gray-900 text-sm">{p.title}</p>
                {p.body && <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{p.body}</p>}
                {p.amount != null && <p className="text-sm font-bold text-gray-800">{fmt(p.amount)} F</p>}
                {p.meetingAt && (
                  <p className="text-xs text-blue-700 flex items-center gap-1">
                    <CalendarClock size={12} /> {new Date(p.meetingAt).toLocaleString('fr-FR')}
                    {p.meetingPlace && <> · <MapPin size={12} /> {p.meetingPlace}</>}
                  </p>
                )}
                {p.meetingLink && (
                  <a href={p.meetingLink} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline flex items-center gap-1">
                    <Video size={12} /> Rejoindre la réunion en ligne
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, color, border, label, value }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 border-l-4 ${border}`}>
      <div className={`flex items-center gap-1.5 ${color}`}><Icon size={14} /><span className="text-[10px] font-semibold uppercase text-gray-500">{label}</span></div>
      <p className="text-lg font-bold text-gray-900 mt-1">{value}</p>
    </div>
  )
}

// ── POP-UP des plans (s'ouvre au clic sur le bouton « Actions » / « Associés ») ──
function PlansPopup({ cfg, ownedKeys, onClose, onDone }) {
  const allFeeCatalog = (Array.isArray(cfg?.feeCategories) && cfg.feeCategories.length > 0)
    ? cfg.feeCategories
    : ALL_FEE_CATALOG

  const [selected, setSelected] = useState(() => {
    return (cfg?.plans || []).find((p) => !ownedKeys.has(p.key) && p.isActive !== false) || (cfg?.plans || [])[0] || null
  })
  const [percent, setPercent] = useState(1)        // pourcentage d'actions choisi
  const [showTerms, setShowTerms] = useState(false) // lecture des conditions
  const [accepted, setAccepted] = useState(false)
  const [method, setMethod] = useState('wallet')   // 'wallet' (portefeuille) | 'momo' (Mobile Money)
  const [balance, setBalance] = useState(null)      // solde du portefeuille
  const [f, setF] = useState({ zone: '', phone: '', operator: 'mtn', pin: '' })
  const [zoneId, setZoneId] = useState('')
  const [zonesList, setZonesList] = useState([])

  useEffect(() => {
    zonesApi.list().then((res) => {
      if (res?.zones) setZonesList(res.zones)
    }).catch(() => {})
  }, [])

  const availableZonesForPlan = zonesList.filter((z) => {
    if (!selected) return false
    if (selected.key === 'arrondissement') return z.type === 'arrondissement'
    if (selected.key === 'regional') return z.type === 'regional'
    if (selected.key === 'national') return z.type === 'national'
    if (selected.key === 'international' || selected.key === 'mondial') return z.type === 'international' || z.type === 'mondial'
    return false
  })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const inline = useInlineCheckout()

  const promo = cfg?.promo || {}
  const isSoldOut = !!promo.isSoldOut
  const remainingPromoPercent = Math.max(0, Number(promo.remainingPercent) || 0)
  const maxPercentAllowed = Math.max(1, Math.min(100, remainingPromoPercent || 10))

  const basePercent = Number(selected?.percent) || 1
  const unitPrice = (Number(selected?.price) || 0) / basePercent
  const rawPrice = percent * unitPrice
  const hasDiscount = percent >= 3
  const discountAmount = hasDiscount ? Math.round(rawPrice * 0.20) : 0
  const finalPrice = Math.max(0, rawPrice - discountAmount)

  const needZone = selected && selected.key !== 'international' && selected.key !== 'mondial'

  // Charge le solde du portefeuille à l'ouverture (pour le paiement par portefeuille)
  useEffect(() => {
    walletApi.me().then((w) => setBalance(Number(w?.balance) || 0)).catch(() => setBalance(0))
  }, [])

  const submit = async () => {
    setErr('')
    if (isSoldOut) {
      setErr("L'offre promotionnelle de 10% d'actions est entièrement atteinte. Les souscriptions sont fermées jusqu'à nouvel ordre.")
      return
    }
    if (!selected) { setErr('Sélectionnez un plan'); return }
    if (percent > remainingPromoPercent) {
      setErr(`Il ne reste plus que ${remainingPromoPercent}% d'actions disponible(s) dans le quota promotionnel.`)
      return
    }
    if (needZone && !f.zone.trim()) { setErr(ZONE_LABELS[selected.key] + ' requis'); return }
    if (!accepted) { setErr('Veuillez cocher « J\'accepte les conditions »'); return }

    // ── Paiement depuis le solde du portefeuille ──
    if (method === 'wallet') {
      if (!f.pin) { setErr('Code PIN requis'); return }
      if (balance != null && balance < finalPrice) {
        setErr('Solde insuffisant (' + fmt(balance) + ' F disponibles contre ' + fmt(finalPrice) + ' F requis). Effectuez d\'abord un dépôt.');
        return
      }
      setBusy(true)
      setStatus('Paiement depuis votre portefeuille...')
      try {
        await shareholdersApi.subscribeWallet({ planKey: selected.key, percent, zone: f.zone.trim(), zoneId: zoneId || undefined, pin: f.pin })
        onDone()
      } catch (e) { setErr(e.message); setStatus('') } finally { setBusy(false) }
      return
    }

    // ── Paiement Mobile Money (Direct Charge H2H) ──
    inline.start(
      (momo = {}) => shareholdersApi.subscribe({ planKey: selected.key, percent, zone: f.zone.trim(), zoneId: zoneId || undefined, ...momo }),
      async () => { onDone() },
      { amount: finalPrice, title: 'Souscription associé (' + percent + '%) — ' + (selected.label || '') }
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Landmark size={18} className="text-indigo-600" /> Devenez associé
          </h3>
          <button onClick={() => !busy && onClose()} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Bloc d'affichage de la promotion 10% */}
          {isSoldOut ? (
            <div className="bg-gradient-to-br from-red-50 to-amber-50 border-2 border-red-200 rounded-2xl p-5 text-center space-y-2">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                <Lock size={22} />
              </div>
              <span className="inline-block px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">
                Offre Promotionnelle Clôturée
              </span>
              <h4 className="text-sm font-bold text-gray-900">
                Le quota de 10% d'actions allouées a été entièrement souscrit
              </h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                La souscription est actuellement verrouillée jusqu'à nouvel ordre. Merci de contacter l'administration pour plus d'informations.
              </p>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white rounded-2xl p-3.5 shadow-sm space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  🔥 PROMO : 10% D'ACTIONS DISPONIBLES
                </span>
                <span className="text-xs font-bold bg-white text-orange-700 px-2 py-0.5 rounded-full shadow-2xs">
                  Reste {remainingPromoPercent}% disponible(s)
                </span>
              </div>
              <p className="text-xs font-bold text-white/95">
                Prix des actions en promotion ! Dès 3%, profitez en plus d'une remise automatique de 20%.
              </p>
              <div className="space-y-1">
                <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-white h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(5, ((promo.totalSubscribed || 0) / 10) * 100))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] opacity-90 font-medium">
                  <span>{promo.totalSubscribed || 0}% souscrits</span>
                  <span>Quota max : 10%</span>
                </div>
              </div>
            </div>
          )}

          {/* Si promo sold out, on n'affiche pas le formulaire de souscription */}
          {isSoldOut ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-primary w-full justify-center bg-gray-800 hover:bg-gray-900"
              >
                Fermer
              </button>
            </div>
          ) : (
            <>
              {/* Plans par zone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(cfg.plans || []).map((p) => {
                  const owned = ownedKeys.has(p.key)
                  const isSel = selected?.key === p.key
                  const pFees = (Array.isArray(p.allowedFeeCategories) && p.allowedFeeCategories.length > 0)
                    ? p.allowedFeeCategories
                    : allFeeCatalog.map((x) => x.key)

                  return (
                    <button
                      key={p.key}
                      type="button"
                      disabled={owned}
                      onClick={() => {
                        setSelected(p)
                        setPercent(Math.min(maxPercentAllowed, Math.max(1, Number(p.percent) || 1)))
                      }}
                      className={`text-left rounded-xl overflow-hidden border-2 transition-all ${
                        owned ? 'opacity-50 cursor-not-allowed border-gray-100'
                          : isSel ? 'border-indigo-600 ring-2 ring-indigo-200 scale-[1.02]' : 'border-gray-100 hover:border-indigo-200'
                      }`}
                    >
                      <div className={`bg-gradient-to-br ${PLAN_GRADIENTS[p.key] || 'from-indigo-500 to-purple-600'} text-white p-3`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-[11px] font-semibold uppercase opacity-90">{p.label}</p>
                          <span className="text-[9px] font-black bg-white/25 px-1.5 py-0.5 rounded uppercase">PROMO</span>
                        </div>
                        <p className="text-lg font-bold">{fmt(p.price)} <span className="text-xs">F</span></p>
                        <p className="text-[10px] opacity-80">{p.percent}% · {p.durationYears} ans · non remboursable</p>
                      </div>
                      <div className="px-2.5 py-1.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-gray-600 flex items-center gap-1">
                          <Coins size={11} className="text-amber-500" />
                          <span className="font-bold text-indigo-700">{pFees.length}</span>/{allFeeCatalog.length} flux inclus
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          {p.percent}% part
                        </span>
                      </div>
                      {isSel && !owned && (
                        <div className="p-1 text-center text-[10px] font-bold text-indigo-700 bg-indigo-50 border-t border-indigo-100 flex items-center justify-center gap-1">
                          <CheckCircle2 size={11} /> Plan sélectionné
                        </div>
                      )}
                      {owned && <div className="p-1 text-center text-[10px] text-gray-400 bg-gray-50">Déjà souscrit</div>}
                    </button>
                  )
                })}
              </div>

              {/* Transparence des frais et commissions inclus dans le plan sélectionné */}
              {selected && (() => {
                const selectedPlanFees = (Array.isArray(selected.allowedFeeCategories) && selected.allowedFeeCategories.length > 0)
                  ? selected.allowedFeeCategories
                  : allFeeCatalog.map((x) => x.key)

                return (
                  <div className="bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white rounded-2xl p-4 border border-indigo-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between gap-2 border-b border-indigo-100/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-2xs">
                          <Coins size={16} />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                            Frais et commissions inclus dans ce plan
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {selectedPlanFees.length} / {allFeeCatalog.length} flux rémunérés
                            </span>
                          </h4>
                          <p className="text-[10px] text-gray-500">
                            En souscrivant, vous gagnerez <b className="text-indigo-700">{percent}% de quote-part</b> sur chaque opération effectuée dans votre zone :
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Grille transparente des flux de frais */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                      {allFeeCatalog.map((fee) => {
                        const isIncluded = selectedPlanFees.includes(fee.key)
                        return (
                          <div
                            key={fee.key}
                            className={`p-2.5 rounded-xl border text-xs transition-all ${
                              isIncluded
                                ? 'bg-white border-emerald-200 shadow-2xs ring-1 ring-emerald-100/60'
                                : 'bg-gray-50/60 border-gray-200/60 opacity-50'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <div className={`mt-0.5 shrink-0 ${isIncluded ? 'text-emerald-600' : 'text-gray-400'}`}>
                                {isIncluded ? <CheckCircle2 size={15} /> : <X size={15} />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className={`text-[11px] font-bold ${isIncluded ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                                    {fee.label}
                                  </span>
                                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                                    isIncluded
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-gray-100 text-gray-400'
                                  }`}>
                                    {isIncluded ? `${percent}%` : 'Exclu'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
                                  {fee.desc}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="text-[10px] text-gray-600 bg-white/90 rounded-xl p-2.5 border border-indigo-100 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-amber-500 shrink-0" />
                      <span>
                        <b>Transparence totale garantie :</b> Tous les frais cochés par l'administrateur pour ce plan s'appliquent immédiatement à chaque opération effectuée par les utilisateurs rattachés à votre zone géographique.
                      </span>
                    </div>
                  </div>
                )
              })()}

              {/* Formulaire (zone + mode de paiement) — visible dès qu'un plan est choisi */}
              {selected && (
                <div className="space-y-3 border-t border-gray-100 pt-3">
                  {/* Choix dynamique du pourcentage d'actions et remise de 20% dès 3% */}
                  <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/60 rounded-2xl p-4 border border-indigo-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-800">
                        Pourcentage d'actions souhaité (%)
                      </label>
                      {hasDiscount && (
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 animate-pulse">
                          🎉 -20% de remise appliquée !
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setPercent((prev) => Math.max(1, prev - 1))}
                        className="w-9 h-9 rounded-xl bg-white border border-gray-200 font-black text-gray-700 hover:bg-gray-50 flex items-center justify-center text-base shadow-2xs"
                      >
                        -
                      </button>
                      <div className="flex-1 relative">
                        <input
                          type="number"
                          min="1"
                          max={maxPercentAllowed}
                          value={percent}
                          onChange={(e) => {
                            const val = Math.floor(Number(e.target.value) || 1)
                            setPercent(Math.max(1, Math.min(maxPercentAllowed, val)))
                          }}
                          className="input w-full text-center font-black text-lg text-indigo-700 py-1.5"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">%</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPercent((prev) => Math.min(maxPercentAllowed, prev + 1))}
                        className="w-9 h-9 rounded-xl bg-white border border-gray-200 font-black text-gray-700 hover:bg-gray-50 flex items-center justify-center text-base shadow-2xs"
                      >
                        +
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600 pt-1 border-t border-indigo-100/60">
                      <span>Base (1%) : <b>{fmt(unitPrice)} F</b></span>
                      <div className="text-right">
                        {hasDiscount && (
                          <span className="line-through text-gray-400 mr-2 text-[11px]">{fmt(rawPrice)} F</span>
                        )}
                        <span className="font-black text-indigo-700 text-sm">{fmt(finalPrice)} FCFA</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500">
                        Disponibilité promo : <b>{remainingPromoPercent}% restant(s)</b>
                      </span>
                      {hasDiscount && (
                        <span className="text-emerald-700 font-semibold">
                          ✨ Remise : -{fmt(discountAmount)} F
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block flex items-center justify-between">
                      <span>{ZONE_LABELS[selected.key] || "Zone d'attribution"}{needZone ? ' *' : ''}</span>
                      {availableZonesForPlan.length > 0 && (
                        <span className="text-[10px] text-indigo-600 font-semibold">{availableZonesForPlan.length} zone(s) configurée(s)</span>
                      )}
                    </label>
                    {availableZonesForPlan.length > 0 ? (
                      <select
                        value={zoneId}
                        onChange={(e) => {
                          const zid = e.target.value
                          setZoneId(zid)
                          const zObj = availableZonesForPlan.find((x) => String(x._id) === String(zid))
                          setF({ ...f, zone: zObj ? zObj.name : '' })
                        }}
                        className="input w-full font-medium"
                      >
                        <option value="">-- Choisir dans la liste ({ZONE_LABELS[selected.key] || selected.key}) --</option>
                        {availableZonesForPlan.map((z) => (
                          <option key={z._id} value={z._id}>
                            {z.name} {z.code ? `(${z.code})` : ''} — {z.country}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={f.zone}
                        onChange={(e) => {
                          setZoneId('')
                          setF({ ...f, zone: e.target.value })
                        }}
                        className="input w-full"
                        placeholder={ZONE_LABELS[selected.key] || "Zone d'attribution (saisie libre)"}
                      />
                    )}
                  </div>

                  {/* Choix du mode de paiement */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Mode de paiement</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setMethod('wallet')}
                        className={`flex items-center gap-2 rounded-xl border-2 p-2.5 text-left transition-all ${method === 'wallet' ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-indigo-200'}`}>
                        <Wallet size={16} className="text-indigo-600 flex-shrink-0" />
                        <span className="text-xs font-semibold text-gray-800">Mon portefeuille</span>
                      </button>
                      <button type="button" onClick={() => setMethod('momo')}
                        className={`flex items-center gap-2 rounded-xl border-2 p-2.5 text-left transition-all ${method === 'momo' ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-indigo-200'}`}>
                        <Banknote size={16} className="text-emerald-600 flex-shrink-0" />
                        <span className="text-xs font-semibold text-gray-800">Mobile Money</span>
                      </button>
                    </div>
                  </div>

                  {/* Champs selon le mode choisi */}
                  {method === 'wallet' ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2">
                        <span className="text-xs text-gray-600">Solde disponible</span>
                        <span className={`text-sm font-bold ${balance != null && balance < finalPrice ? 'text-red-600' : 'text-indigo-700'}`}>
                          {balance == null ? '…' : fmt(balance) + ' F'}
                        </span>
                      </div>
                      {balance != null && balance < finalPrice && (
                        <p className="text-[11px] text-red-600">Solde insuffisant ({fmt(finalPrice)} F requis). Rechargez votre portefeuille.</p>
                      )}
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Code PIN du portefeuille *</label>
                        <input type="password" inputMode="numeric" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value })} className="input w-full" placeholder="••••" />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                      Paiement par Mobile Money : l'opérateur et le numéro seront demandés dans la fenêtre de paiement sécurisée Ikeepay.
                    </p>
                  )}
                </div>
              )}

              {/* Petit carreau + mini lien bleu « J'accepte les conditions » */}
              <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer border-t border-gray-100 pt-3">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 w-4 h-4 accent-indigo-600 flex-shrink-0" />
                <span>
                  J'accepte les{' '}
                  <button type="button" onClick={(e) => { e.preventDefault(); setShowTerms(true) }} className="text-blue-600 underline font-medium">
                    conditions
                  </button>
                  {' '}de souscription d'associés.
                </span>
              </label>

              {(err || inline.error) && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{err || inline.error}</p>}
              {(status || inline.status) && <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2 flex items-center gap-2"><Loader2 size={12} className="animate-spin" />{status || inline.status}</p>}

              <button onClick={submit} disabled={busy || inline.busy || !selected} className="btn-primary w-full justify-center">
                {(busy || inline.busy) ? <><Loader2 size={16} className="animate-spin" /> Traitement...</>
                  : !selected ? <>Sélectionnez un plan</>
                  : method === 'wallet' ? <>Payer {fmt(finalPrice)} F depuis mon portefeuille ({percent}%)</>
                  : <>Valider — Payer {fmt(finalPrice)} F ({percent}%)</>}
              </button>
              {inline.element}
            </>
          )}
        </div>
      </div>

      {/* Lecture complète des conditions (ouvre par le lien bleu) */}
      {showTerms && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setShowTerms(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between rounded-t-2xl">
              <h4 className="font-bold text-gray-900 text-sm">Conditions de souscription d'associés</h4>
              <button onClick={() => setShowTerms(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-4 text-xs text-gray-700 leading-relaxed">
              <TermSection title="Termes et conditions" text={cfg.terms} />
              <TermSection title="Avantages de l'associé" text={cfg.advantages} />
              <TermSection title="Responsabilités de l'associé" text={cfg.responsibilities} />
              <TermSection title="Droits et obligations de l'associé" text={cfg.rights} />
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-100 p-3">
              <button onClick={() => { setAccepted(true); setShowTerms(false) }} className="btn-primary w-full justify-center text-sm">
                <CheckCircle2 size={15} /> J'ai lu et j'accepte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TermSection({ title, text }) {
  if (!text) return null
  return (
    <div>
      <h5 className="font-semibold text-gray-900 mb-1">{title}</h5>
      <p className="whitespace-pre-line">{text}</p>
    </div>
  )
}



function ShareholderWithdrawModal({ availableBalance = 0, onClose, onSuccess }) {
  const [method, setMethod] = useState('wallet') // 'wallet' | 'momo'
  const [amount, setAmount] = useState('')
  const [operator, setOperator] = useState('orange')
  const [phone, setPhone] = useState('')
  const [accountName, setAccountName] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const amtNum = Number(amount) || 0
  const isWallet = method === 'wallet'
  const fee = isWallet ? 0 : Math.round(amtNum * 0.01)
  const net = isWallet ? amtNum : Math.max(0, amtNum - fee)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const minW = isWallet ? 0.01 : 100
    if (!amtNum || amtNum < minW) {
      setError(isWallet ? 'Le montant minimum de virement est de 0,01 FCFA.' : 'Le montant minimum de retrait Mobile Money est de 100 FCFA.')
      return
    }
    if (amtNum > availableBalance + 0.0001) {
      setError(`Solde insuffisant. Vous ne pouvez retirer que jusqu'à ${fmt(availableBalance)} FCFA.`)
      return
    }
    if (!isWallet) {
      if (!phone || !phone.trim()) {
        setError('Veuillez sélectionner un numéro Mobile Money pour effectuer votre retrait.')
        return
      }
      if (!accountName || !accountName.trim()) {
        setError('Le nom du titulaire du compte est obligatoire.')
        return
      }
    }
    if (!pin.trim()) {
      setError('Le code PIN de votre portefeuille est requis.')
      return
    }

    setLoading(true)
    try {
      const payload = isWallet
        ? {
            amount: amtNum,
            pin: pin.trim(),
            method: 'wallet',
          }
        : {
            amount: amtNum,
            momoNumber: phone.trim(),
            momoOperator: operator,
            accountName: accountName.trim(),
            pin: pin.trim(),
            method: 'momo',
          }

      const res = await shareholdersApi.withdraw(payload)
      onSuccess(res.message || (isWallet ? 'Frais virés sur votre portefeuille avec succès.' : 'Demande de retrait Mobile Money effectuée avec succès.'))
      onClose()
    } catch (err) {
      setError(err?.message || 'Erreur lors du retrait.')
    } finally {
      setLoading(false)
    }
  }

  const isSubmitDisabled =
    loading ||
    amtNum < (isWallet ? 0.01 : 100) ||
    amtNum > availableBalance + 0.0001 ||
    !pin.trim() ||
    (!isWallet && (!phone || !accountName.trim()))

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2 text-emerald-700">
            {isWallet ? <Wallet size={20} /> : <Smartphone size={20} />}
            <h3 className="font-bold text-gray-900 text-sm">
              {isWallet ? "Virement Frais d'Associé → Portefeuille" : "Retrait Frais d'Associé → Mobile Money"}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Choix de la destination : Portefeuille Katd-Schüle ou Mobile Money */}
        <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setMethod('wallet')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              isWallet
                ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Wallet size={16} className={isWallet ? 'text-emerald-600' : 'text-gray-400'} />
            <div className="text-left leading-tight">
              <div>Portefeuille</div>
              <span className="text-[10px] font-normal text-emerald-600 block">0% frais • Immédiat</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMethod('momo')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              !isWallet
                ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Smartphone size={16} className={!isWallet ? 'text-emerald-600' : 'text-gray-400'} />
            <div className="text-left leading-tight">
              <div>Mobile Money</div>
              <span className="text-[10px] font-normal text-gray-500 block">MTN / Orange (1%)</span>
            </div>
          </button>
        </div>

        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">Solde disponible retirable</span>
            <p className="text-[11px] text-emerald-600">Quote-part des frais attribués à votre plan</p>
          </div>
          <span className="text-lg font-black text-emerald-800">{fmt(availableBalance)} FCFA</span>
        </div>

        {isWallet && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2">
            <Sparkles size={16} className="shrink-0 mt-0.5 text-blue-600" />
            <div className="space-y-0.5">
              <span className="font-bold block">Virement direct et gratuit</span>
              <p className="text-[11px] text-blue-700">
                Vos frais d'associé seront instantanément crédités sur votre portefeuille principal Katd-Schüle avec <strong>0 FCFA de frais</strong>. Vous pourrez ensuite les utiliser pour des transferts, paiements ou achats.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          {/* Si Mobile Money : Sélecteur de compte Mobile Money (MTN / Orange) avec recherche et défilement */}
          {!isWallet && (
            <SavedMomoSelector
              selectedOperator={operator}
              selectedPhone={phone}
              selectedName={accountName}
              onSelect={({ operator: op, phone: p, accountName: n }) => {
                setOperator(op)
                setPhone(p)
                setAccountName(n)
              }}
            />
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">
                {isWallet ? 'Montant à virer (FCFA) *' : 'Montant à retirer (FCFA) *'}
              </label>
              <div className="flex gap-1">
                {[0.25, 0.5, 1].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      const val = pct === 1 ? availableBalance : Number((availableBalance * pct).toFixed(4))
                      setAmount(String(val))
                    }}
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 hover:bg-emerald-100 text-gray-700 hover:text-emerald-800"
                  >
                    {pct === 1 ? 'MAX' : `${pct * 100}%`}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              step="any"
              required
              min={isWallet ? 0.01 : 100}
              max={availableBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={isWallet ? "Ex: 0.68 ou 5000" : "Ex: 50000"}
              className="input text-sm font-bold"
            />
          </div>

          {amtNum > 0 && (
            <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-200 text-xs space-y-1">
              {isWallet ? (
                <>
                  <div className="flex justify-between text-gray-500">
                    <span>Frais de virement portefeuille (0%) :</span>
                    <span className="font-semibold text-emerald-600">0 FCFA (Gratuit)</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-bold border-t border-gray-200 pt-1">
                    <span>Montant crédité sur votre portefeuille :</span>
                    <span className="text-sm font-black text-emerald-700">{fmt(net)} FCFA</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-gray-500">
                    <span>Frais de retrait Mobile Money (1%) :</span>
                    <span className="font-semibold text-gray-800">{fmt(fee)} FCFA</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-bold border-t border-gray-200 pt-1">
                    <span>Montant net versé :</span>
                    <span className="text-sm font-black text-emerald-700">{fmt(net)} FCFA</span>
                  </div>
                </>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Code PIN du portefeuille *</label>
            <input
              type="password"
              required
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="input text-center text-base tracking-[0.3em] font-mono"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-ghost flex-1 justify-center border border-gray-200 text-xs py-2.5"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="btn-primary flex-1 justify-center text-xs py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> Traitement...</>
              ) : isWallet ? (
                'Virer vers mon portefeuille'
              ) : (
                'Valider le retrait Mobile Money'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
