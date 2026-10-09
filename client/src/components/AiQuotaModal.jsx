import { useState, useEffect } from 'react'
import {
  Bot, Sparkles, X, Wallet, CreditCard, CheckCircle2, AlertTriangle,
  Loader2, ArrowRight, ShieldCheck, Zap, RefreshCw, Smartphone
} from 'lucide-react'
import { aiApi, walletApi } from '../lib/api'

export default function AiQuotaModal({ isOpen, onClose, onPurchased, initialQuota = null }) {
  const [packages, setPackages] = useState([])
  const [selectedPkg, setSelectedPkg] = useState(null)
  const [quota, setQuota] = useState(initialQuota)
  const [walletInfo, setWalletInfo] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('wallet') // 'wallet' | 'mobile_money'

  // Portefeuille PIN
  const [pin, setPin] = useState('')

  // Mobile Money fields
  const [phone, setPhone] = useState('')
  const [operator, setOperator] = useState('ORANGE')
  const [country, setCountry] = useState('CM')
  const [otp, setOtp] = useState('')

  // États
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [paymentLink, setPaymentLink] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setError('')
      setSuccessMsg('')
      setPaymentLink('')
      setPin('')
      return
    }

    let alive = true
    setLoading(true)

    Promise.all([
      aiApi.listUserPackages().catch(() => ({ data: [] })),
      aiApi.getUserQuota().catch(() => ({ data: null })),
      walletApi.me().catch(() => ({ data: null })),
    ]).then(([pkgsRes, quotaRes, walletRes]) => {
      if (!alive) return
      const pkgs = pkgsRes.data || []
      setPackages(pkgs)
      if (pkgs.length > 0) setSelectedPkg(pkgs[0])
      if (quotaRes.data) setQuota(quotaRes.data)
      if (walletRes.data) setWalletInfo(walletRes.data)
      setLoading(false)
    }).catch(() => {
      if (alive) setLoading(false)
    })

    return () => { alive = false }
  }, [isOpen])

  if (!isOpen) return null

  const handlePayWallet = async () => {
    if (!selectedPkg) return
    setError('')
    setSubmitting(true)
    try {
      const res = await aiApi.subscribeUserWallet({
        packageId: selectedPkg._id,
        pin: pin.trim(),
      })
      setSuccessMsg(res.message || 'Forfait IA activé avec succès !')
      if (res.quota) setQuota(res.quota)
      if (onPurchased) onPurchased(res.quota)
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err) {
      setError(err.message || 'Erreur lors du paiement par portefeuille')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePayMobile = async () => {
    if (!selectedPkg) return
    const rawPhone = String(phone).replace(/[^0-9]/g, '')
    if (!rawPhone || !operator) {
      setError('Veuillez renseigner votre numéro de téléphone et votre opérateur Mobile Money.')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      const res = await aiApi.subscribeUserMobile({
        packageId: selectedPkg._id,
        phone: rawPhone,
        operator,
        country,
        otp: otp.trim(),
      })

      if (res.payment_link) {
        setPaymentLink(res.payment_link)
      }
      setSuccessMsg(res.message || 'Paiement Mobile Money initié. Validez la notification sur votre téléphone.')
      if (onPurchased) onPurchased(null)
    } catch (err) {
      setError(err.message || 'Erreur lors du débit Mobile Money')
    } finally {
      setSubmitting(false)
    }
  }

  const userBalance = walletInfo?.balance || 0
  const pkgPrice = selectedPkg?.price || 0
  const canPayWallet = userBalance >= pkgPrice

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-xl shadow-2xl border border-gray-100 space-y-5 animate-scale-up max-h-[92vh] overflow-y-auto">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md">
              <Sparkles size={22} />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">Recharge de Forfait IA</h3>
              <p className="text-xs text-gray-500">Activez instantanément vos requêtes pour Chat IA et Cours IA.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* État du Quota Actuel */}
        {quota && (
          <div className="p-3.5 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-100 rounded-2xl flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">Votre Solde de Requêtes IA</div>
              <div className="text-lg font-black text-blue-900">
                {quota.totalRemaining || 0} <span className="text-xs font-bold text-blue-700">requêtes restantes</span>
              </div>
            </div>
            <div className="text-right text-[11px] text-blue-800">
              <div>Essai gratuit : {quota.trialRemaining || 0} / {quota.trialTotal || 20}</div>
              <div>Forfait acheté : {quota.purchasedRemaining || 0}</div>
            </div>
          </div>
        )}

        {/* Erreur / Succès */}
        {error && (
          <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-2xl text-xs flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            {paymentLink && (
              <a
                href={paymentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
              >
                <span>Ouvrir la page de paiement</span>
                <ArrowRight size={13} />
              </a>
            )}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-gray-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-600" />
            <span className="text-xs">Chargement des forfaits disponibles...</span>
          </div>
        ) : (
          <>
            {/* Sélection du Forfait */}
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-2">1. Choisissez un forfait</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {packages.map((pkg) => {
                  const isSelected = selectedPkg?._id === pkg._id
                  return (
                    <button
                      key={pkg._id}
                      type="button"
                      onClick={() => setSelectedPkg(pkg)}
                      className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-2 ring-indigo-500/20'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-900">{pkg.name}</span>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                            <CheckCircle2 size={13} />
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex items-baseline justify-between">
                        <span className="text-lg font-black text-indigo-600">
                          +{pkg.totalQuestions} <span className="text-[11px] font-bold text-gray-500">requêtes</span>
                        </span>
                        <span className="text-sm font-black text-gray-900">
                          {pkg.price.toLocaleString('fr-FR')} <span className="text-[10px] text-gray-500">{pkg.currency || 'F CFA'}</span>
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Choix du Moyen de Paiement */}
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-2">2. Mode de paiement</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('wallet')}
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-all text-left ${
                    paymentMethod === 'wallet'
                      ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                    <Wallet size={18} />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-gray-900">Portefeuille</div>
                    <div className="text-[11px] text-gray-500">
                      Solde : {userBalance.toLocaleString('fr-FR')} F CFA
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('mobile_money')}
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-all text-left ${
                    paymentMethod === 'mobile_money'
                      ? 'border-amber-600 bg-amber-50/40 ring-2 ring-amber-500/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                    <Smartphone size={18} />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-gray-900">Mobile Money</div>
                    <div className="text-[11px] text-gray-500">Orange, MTN, Moov...</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Formulaire selon Mode de Paiement */}
            {paymentMethod === 'wallet' ? (
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gray-600">Montant à débiter :</span>
                  <span className="text-gray-900 font-black">{pkgPrice.toLocaleString('fr-FR')} F CFA</span>
                </div>

                {!canPayWallet && (
                  <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                    Solde insuffisant dans votre portefeuille ({userBalance.toLocaleString('fr-FR')} F CFA). Choisissez le mode Mobile Money ou rechargez votre portefeuille.
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">
                    Code PIN Portefeuille (si configuré)
                  </label>
                  <input
                    type="password"
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Code PIN"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="button"
                  disabled={!canPayWallet || submitting}
                  onClick={handlePayWallet}
                  className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Validation du débit en cours...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={14} />
                      <span>Activer par Portefeuille ({pkgPrice.toLocaleString('fr-FR')} F CFA)</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">Pays</label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 focus:outline-none"
                    >
                      <option value="CM">Cameroun</option>
                      <option value="CI">Côte d'Ivoire</option>
                      <option value="SN">Sénégal</option>
                      <option value="BF">Burkina Faso</option>
                      <option value="ML">Mali</option>
                      <option value="BJ">Bénin</option>
                      <option value="TG">Togo</option>
                      <option value="NE">Niger</option>
                      <option value="GA">Gabon</option>
                      <option value="CD">RDC</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">Opérateur</label>
                    <select
                      value={operator}
                      onChange={(e) => setOperator(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 focus:outline-none"
                    >
                      <option value="ORANGE">Orange Money</option>
                      <option value="MTN">MTN Mobile Money</option>
                      <option value="MOOV">Moov Money</option>
                      <option value="WAVE">Wave</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">Numéro Mobile Money *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="6XXXXXXXX"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {operator === 'ORANGE' && (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">
                      Code d'autorisation / OTP (si requis par Orange)
                    </label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="#150# code OTP"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handlePayMobile}
                  className="w-full py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Initiation Mobile Money...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard size={14} />
                      <span>Payer par Mobile Money ({pkgPrice.toLocaleString('fr-FR')} F CFA)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
