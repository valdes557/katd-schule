// routes/merchant.js — Compte marchand : activation (6933 F MoMo) + tableau de bord commissions
const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const { protect } = require('../middleware/auth')
const User = require('../models/User')
const PaymentIntent = require('../models/PaymentIntent')
const WalletTransaction = require('../models/WalletTransaction')
const wallet = require('../services/walletService')
const ikeepay = require('../services/ikeepayService')

// Frais d'activation d'un compte marchand (fixés côté serveur, non modifiables par le client)
const MERCHANT_FEE = 6933
function genRef(p) { return p + '_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex') }

// GET /api/merchant/me — statut marchand + solde + commissions gagnées
router.get('/me', protect, async (req, res) => {
  try {
    const u = await User.findById(req.user._id).select('isMerchant merchantSince')
    const w = await wallet.getOrCreateWallet(req.user._id, { role: req.user.role, school: req.user.school?._id })
    const accountNo = await wallet.ensureAccountNo(req.user._id)
    // Parrainage : code/lien partageable (généré paresseusement) + agrégats des bonus reçus.
    const referralCode = await wallet.ensureReferralCode(req.user._id)
    const referralCount = await User.countDocuments({ referredBy: req.user._id })
    const referralTxs = await WalletTransaction.find({ owner: req.user._id, type: 'referral_bonus' }).select('amount').lean()
    const referralEarned = referralTxs.reduce((s, t) => s + (t.amount || 0), 0)

    // Commissions (type merchant_commission) : total + mois en cours + dernières opérations
    const commissions = await WalletTransaction.find({ owner: req.user._id, type: 'merchant_commission' })
      .populate('counterparty', 'name walletAccountNo').sort({ createdAt: -1 }).limit(50).lean()
    const commissionTotal = commissions.reduce((s, t) => s + (t.amount || 0), 0)
    const startOfMonth = new Date()
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
    const commissionThisMonth = commissions
      .filter((t) => new Date(t.createdAt) >= startOfMonth)
      .reduce((s, t) => s + (t.amount || 0), 0)

    res.json({
      success: true,
      isMerchant: !!u?.isMerchant,
      merchantSince: u?.merchantSince || null,
      fee: MERCHANT_FEE,
      balance: w.balance, locked: w.locked, currency: w.currency, accountNo,
      referralCode, referralCount, referralEarned,
      commissionTotal, commissionThisMonth,
      transactions: commissions.map((t) => ({
        _id: t._id, amount: t.amount, createdAt: t.createdAt,
        description: t.description, counterpartyName: t.counterparty?.name || null,
        counterpartyAccountNo: t.counterparty?.walletAccountNo || null,
      })),
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/merchant/initiate — paie les 6933 F via Mobile Money (collecte Ikeepay H2H)
router.post('/initiate', protect, async (req, res) => {
  try {
    const { phone, operator, country = 'CM', otp } = req.body
    const u = await User.findById(req.user._id).select('isMerchant email')
    if (u?.isMerchant) return res.status(400).json({ message: 'Vous êtes déjà marchand.' })
    const rawPhone = String(phone || '').replace(/[^0-9]/g, '')
    if (!rawPhone || !operator) {
      return res.status(400).json({ message: 'Numéro de téléphone et opérateur Mobile Money requis pour le débit direct.' })
    }

    const reference = genRef('mch')
    const { mode } = await ikeepay.resolveConfig()
    const normCountry = String(country || 'CM').trim().toUpperCase()
    const targetCurrency = ikeepay.getCountryCurrency ? ikeepay.getCountryCurrency(normCountry) : (normCountry === 'CM' ? 'XAF' : 'XOF')

    const intent = await PaymentIntent.create({
      reference, purpose: 'merchant', amount: MERCHANT_FEE, currency: targetCurrency,
      payerPhone: rawPhone, payerOperator: operator, initiatedBy: req.user._id,
      school: req.user.school?._id || null, mode,
    })
    const base = (process.env.SERVER_URL || '').replace(/\/$/, '')
    const result = await ikeepay.createCollection({
      amount: MERCHANT_FEE, phone: rawPhone, operator, reference,
      callbackUrl: base + '/api/payments/webhook', country: normCountry,
      currency: targetCurrency, customerEmail: u?.email || '', otp
    })
    if (result.transaction_id || result.id) { intent.providerTransactionId = result.transaction_id || result.id; await intent.save() }
    const paymentLink = result.payment_link || result.redirect_url || (result.data && (result.data.payment_link || result.data.redirect_url)) || null
    res.json({
      success: true, reference, amount: MERCHANT_FEE, mode, currency: targetCurrency,
      payment_link: paymentLink, message: 'Validez le paiement sur votre téléphone Mobile Money.'
    })
  } catch (err) { res.status(err.status || 500).json({ message: err.message }) }
})


const CollectClient = require('../models/CollectClient')
const DailyCollection = require('../models/DailyCollection')

// GET /api/merchant/collect-client-lookup?accountNumber=CL-XXXXXX ou KSXXXXXX ou Téléphone/Email
router.get('/collect-client-lookup', protect, async (req, res) => {
  try {
    const raw = String(req.query.accountNumber || '').trim()
    if (!raw) return res.status(400).json({ message: 'Numéro de compte, téléphone ou email du client requis' })

    const upper = raw.toUpperCase()
    let clAcc = upper
    if (!clAcc.startsWith('CL-') && /^\d{6}$/.test(clAcc)) clAcc = 'CL-' + clAcc

    let ksAcc = upper
    if (/^KS-?[0-9]{6}$/i.test(upper)) ksAcc = 'KS' + upper.replace(/[^0-9]/g, '')
    else if (/^[0-9]{6}$/.test(upper)) ksAcc = 'KS' + upper

    const phoneClean = raw.replace(/[^0-9]/g, '')

    // 1. Recherche prioritaire dans les comptes clients de collecte (CL-XXXXXX)
    const collectClient = await CollectClient.findOne({
      $or: [
        { accountNumber: clAcc },
        { accountNumber: upper },
        ...(phoneClean.length >= 8 ? [{ phone: new RegExp(phoneClean.slice(-9) + '$') }] : []),
        ...(raw.includes('@') ? [{ email: raw.toLowerCase() }] : []),
      ],
      status: 'active',
    }).populate('agent')

    if (collectClient) {
      return res.json({
        success: true,
        type: 'collect',
        client: {
          _id: collectClient._id,
          accountNumber: collectClient.accountNumber,
          fullName: collectClient.fullName,
          neighborhood: collectClient.neighborhood || 'Quartier principal',
          phone: collectClient.phone,
          agencyName: collectClient.agent?.agencyName || '',
          balance: collectClient.balance || 0,
        },
      })
    }

    // 2. Recherche secondaire dans les comptes utilisateurs de la plateforme (KSXXXXXX)
    const destUser = await User.findOne({
      $or: [
        { walletAccountNo: ksAcc },
        ...(phoneClean.length >= 8 ? [{ phone: new RegExp(phoneClean.slice(-9) + '$') }] : []),
        ...(raw.includes('@') ? [{ email: raw.toLowerCase() }] : []),
      ],
    }).select('_id name phone email walletAccountNo isMerchant role')

    if (destUser) {
      const isSelf = String(destUser._id) === String(req.user._id)
      if (isSelf) return res.status(400).json({ message: 'Ceci est votre propre compte.' })
      return res.json({
        success: true,
        type: 'user',
        client: {
          _id: destUser._id,
          accountNumber: destUser.walletAccountNo || ('KS' + String(destUser._id).slice(-6).toUpperCase()),
          fullName: destUser.name,
          phone: destUser.phone || '',
          email: destUser.email || '',
          isMerchant: !!destUser.isMerchant,
        },
      })
    }

    return res.status(404).json({ message: 'Aucun compte client trouvé avec cet identifiant (CL-..., KS-..., téléphone ou email).' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/merchant/transfer-to-collect-client — Transfert depuis le solde marchand vers le compte d'un client (collecte ou standard)
router.post('/transfer-to-collect-client', protect, async (req, res) => {
  try {
    const u = await User.findById(req.user._id).select('isMerchant name phone role')
    if (!u?.isMerchant && u?.role !== 'super_admin') {
      return res.status(403).json({ message: 'Action réservée aux comptes marchands actifs.' })
    }

    const { accountNumber, amount, notes } = req.body
    const amt = Math.round(Number(amount) || 0)
    if (!amt || amt <= 0) {
      return res.status(400).json({ message: 'Montant de transfert invalide (doit être supérieur à 0 FCFA).' })
    }

    const raw = String(accountNumber || '').trim()
    if (!raw) {
      return res.status(400).json({ message: 'Numéro de compte, téléphone ou email du client requis.' })
    }

    const upper = raw.toUpperCase()
    let clAcc = upper
    if (!clAcc.startsWith('CL-') && /^\d{6}$/.test(clAcc)) clAcc = 'CL-' + clAcc

    let ksAcc = upper
    if (/^KS-?[0-9]{6}$/i.test(upper)) ksAcc = 'KS' + upper.replace(/[^0-9]/g, '')
    else if (/^[0-9]{6}$/.test(upper)) ksAcc = 'KS' + upper

    const phoneClean = raw.replace(/[^0-9]/g, '')

    // Vérifie le solde du portefeuille marchand
    const w = await wallet.getOrCreateWallet(req.user._id, { role: req.user.role, school: req.user.school?._id })
    if (w.balance < amt) {
      return res.status(400).json({
        message: 'Solde insuffisant sur votre compte marchand (' + w.balance.toLocaleString('fr-FR') + ' FCFA disponibles).',
      })
    }

    // 1. Recherche si c'est un client de collecte (CL-XXXXXX)
    const collectClient = await CollectClient.findOne({
      $or: [
        { accountNumber: clAcc },
        { accountNumber: upper },
        ...(phoneClean.length >= 8 ? [{ phone: new RegExp(phoneClean.slice(-9) + '$') }] : []),
        ...(raw.includes('@') ? [{ email: raw.toLowerCase() }] : []),
      ],
      status: 'active',
    })

    if (collectClient) {
      // Débit du compte marchand
      await wallet.debit(req.user._id, {
        amount: amt,
        type: 'transfer_sent',
        description: 'Transfert marchand vers compte collecte : ' + collectClient.fullName + ' (' + collectClient.accountNumber + ')',
        meta: {
          reason: 'merchant_transfer_to_collect_client',
          clientId: String(collectClient._id),
          clientAccountNumber: collectClient.accountNumber,
          notes: notes || '',
        },
      })

      // Crédit du solde de collecte du client
      collectClient.balance = (collectClient.balance || 0) + amt
      await collectClient.save()

      // Vérifie et applique les frais mensuels si solde >= 1100 FCFA
      try {
        const collectModule = require('./collect')
        if (typeof collectModule.checkAndApplyMonthlyFeeForClient === 'function') {
          await collectModule.checkAndApplyMonthlyFeeForClient(collectClient)
        }
      } catch (_) {}

      // Enregistrement dans DailyCollection (sans bloquer si agentUser/agent est null)
      try {
        const today = new Date().toISOString().slice(0, 10)
        await DailyCollection.create({
          agent: collectClient.agent || null,
          agentUser: collectClient.agentUser || req.user._id,
          client: collectClient._id,
          clientName: collectClient.fullName,
          clientPhone: collectClient.phone || '',
          neighborhood: collectClient.neighborhood || 'Quartier principal',
          date: today,
          amount: amt,
          type: 'depot',
          status: 'paye',
          paymentMethod: 'wallet',
          notes: 'Transfert reçu du marchand ' + (u.name || 'Marchand') + (notes ? ' (' + notes + ')' : ''),
          datetime: new Date(),
        })
      } catch (colErr) {
        console.warn('DailyCollection log non-fatal error:', colErr.message)
      }

      const freshWallet = await wallet.getOrCreateWallet(req.user._id)
      return res.json({
        success: true,
        type: 'collect',
        message: 'Transfert de ' + amt.toLocaleString('fr-FR') + ' FCFA vers le compte collecte de ' + collectClient.fullName + ' (' + collectClient.accountNumber + ') effectué avec succès !',
        merchantBalance: freshWallet.balance,
        client: {
          _id: collectClient._id,
          accountNumber: collectClient.accountNumber,
          fullName: collectClient.fullName,
          newBalance: collectClient.balance,
        },
      })
    }

    // 2. Recherche si c'est un compte utilisateur standard de la plateforme (KSXXXXXX)
    const destUser = await User.findOne({
      $or: [
        { walletAccountNo: ksAcc },
        ...(phoneClean.length >= 8 ? [{ phone: new RegExp(phoneClean.slice(-9) + '$') }] : []),
        ...(raw.includes('@') ? [{ email: raw.toLowerCase() }] : []),
      ],
    })

    if (destUser) {
      if (String(destUser._id) === String(req.user._id)) {
        return res.status(400).json({ message: 'Impossible de transférer vers votre propre compte.' })
      }

      // Transfert inter-utilisateurs standard (exonération frais pour marchand + commission 0,20%)
      const r = await wallet.transferBetweenUsers(req.user._id, destUser._id, {
        amount: amt,
        reason: notes ? String(notes).trim() : 'Transfert marchand vers compte client',
      })

      const freshWallet = await wallet.getOrCreateWallet(req.user._id)
      return res.json({
        success: true,
        type: 'user',
        message: 'Transfert de ' + amt.toLocaleString('fr-FR') + ' FCFA vers le compte client de ' + (destUser.name || 'Client') + ' (' + (destUser.walletAccountNo || '') + ') effectué avec succès !' + (r.commission > 0 ? ` (Commission gagnée : +${r.commission} F)` : ''),
        merchantBalance: freshWallet.balance,
        commission: r.commission || 0,
        client: {
          _id: destUser._id,
          accountNumber: destUser.walletAccountNo,
          fullName: destUser.name,
        },
      })
    }

    return res.status(404).json({ message: 'Compte client introuvable ou inactif.' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
