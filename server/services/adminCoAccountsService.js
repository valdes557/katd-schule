// services/adminCoAccountsService.js — Moteur de répartition 60% / 40% et gestion sécurisée
const AdminCoAccount = require('../models/AdminCoAccount')
const Shareholding = require('../models/Shareholding')
const { sendEmail } = require('../utils/emailService')

// Noms conviviaux des 8 catégories de frais
const CATEGORY_LABELS = {
  withdrawal_fee: 'Frais de retrait',
  transfer_fee: 'Frais de transfert',
  maintenance_fee: 'Frais de maintenance',
  subscription: "Frais de souscription d'école",
  ai_subscription: 'Frais de souscription IA',
  collect_fee: 'Frais de fonctionnement mensuel (collecte journalière)',
  merchant_signup: "Frais d'ouverture compte Marchand",
  agent_signup: "Frais d'ouverture compte agent de collecte",
  client_signup: "Frais de souscription client collecte journalière",
}

/**
 * Calcule dynamiquement les pourcentages d'actions actuels des 2 comptes :
 * 10% d'actions sont mises en vente pour les associés/actionnaires.
 * Si X% d'actions sont souscrites par les actionnaires :
 * - Compte 1 cède : X * 0.60
 * - Compte 2 cède : X * 0.40
 * Part actuelle Compte 1 = 60.00% - (X * 0.60)
 * Part actuelle Compte 2 = 40.00% - (X * 0.40)
 */
async function getDynamicShareholdingStats() {
  const activeHoldings = await Shareholding.find({ status: 'active' }).lean()
  const totalExternalShares = activeHoldings.reduce((sum, h) => sum + (Number(h.percent) || 1), 0)

  const c1Deduction = Number((totalExternalShares * 0.60).toFixed(2))
  const c2Deduction = Number((totalExternalShares * 0.40).toFixed(2))

  const c1CurrentPercent = Math.max(0, Number((60.00 - c1Deduction).toFixed(2)))
  const c2CurrentPercent = Math.max(0, Number((40.00 - c2Deduction).toFixed(2)))

  return {
    totalExternalShares,
    maxExternalShares: 10,
    compte1: {
      initialPercent: 60.00,
      deductionPercent: c1Deduction,
      currentPercent: c1CurrentPercent,
    },
    compte2: {
      initialPercent: 40.00,
      deductionPercent: c2Deduction,
      currentPercent: c2CurrentPercent,
    },
  }
}

/**
 * Enregistre un revenu/frais plateforme et le répartit automatiquement :
 * - 60% pour Compte 1 (tankoujohnson@gmail.com)
 * - 40% pour Compte 2 (valdeslando15@gmail.com)
 */
async function recordPlatformFee({ category, amount, description = '', reference = '', meta = {} }) {
  const amt = Math.round(Number(amount) || 0)
  if (amt <= 0) return

  const { acc1, acc2 } = await AdminCoAccount.ensureAccounts()

  const share1 = Math.round(amt * 0.60)
  const share2 = amt - share1 // garantie de conservation exacte du centime/franc

  const now = new Date()

  // 1. Crédit Compte 1 (60%)
  acc1.balance += share1
  acc1.totalEarned += share1
  acc1.ledger.push({
    category,
    totalPlatformAmount: amt,
    sharePercent: 60,
    accountShareAmount: share1,
    description: description || CATEGORY_LABELS[category] || category,
    reference: String(reference || ''),
    date: now,
  })
  await acc1.save()

  // 2. Crédit Compte 2 (40%)
  acc2.balance += share2
  acc2.totalEarned += share2
  acc2.ledger.push({
    category,
    totalPlatformAmount: amt,
    sharePercent: 40,
    accountShareAmount: share2,
    description: description || CATEGORY_LABELS[category] || category,
    reference: String(reference || ''),
    date: now,
  })
  await acc2.save()

  console.log(`[AdminCoAccounts] Frais répartis [${category}] : Total = ${amt} F → C1(60%) = ${share1} F, C2(40%) = ${share2} F`)
}

/**
 * Génère et expédie un code OTP par email pour déverrouiller un compte
 */
async function sendAccountOtp(accountKey) {
  const { acc1, acc2 } = await AdminCoAccount.ensureAccounts()
  const account = accountKey === 'account_1' ? acc1 : acc2

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  account.currentOtp = code
  account.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  await account.save()

  const accountTitle = accountKey === 'account_1' ? 'Compte 1 (60%)' : 'Compte 2 (40%)'

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 540px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0; font-size: 20px;">Sécurité KATD-SCHÜLE</h2>
        <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">Accès au ${accountTitle}</p>
      </div>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
        <p style="font-size: 13px; color: #475569; margin: 0 0 10px;">Voici votre code de sécurité à usage unique :</p>
        <div style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #2563eb; font-family: monospace;">${code}</div>
        <p style="font-size: 12px; color: #94a3b8; margin: 10px 0 0;">Ce code est valable pendant 10 minutes.</p>
      </div>
      <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0;">
        Ce code a été demandé depuis le tableau de bord administrateur pour consulter et gérer les revenus associés. Ne le partagez avec personne.
      </p>
    </div>
  `

  await sendEmail({
    to: account.email,
    subject: `Code de sécurité d'accès au ${accountTitle} : ${code}`,
    html,
  })

  console.log(`[AdminCoAccounts] Code OTP généré pour ${account.email} (${accountKey}) : ${code}`)
  return { success: true, email: account.email, devCode: process.env.NODE_ENV !== 'production' ? code : undefined }
}

/**
 * Valide l'OTP saisi et retourne les données complètes du compte
 */
async function verifyAccountOtp(accountKey, code) {
  const { acc1, acc2 } = await AdminCoAccount.ensureAccounts()
  const account = accountKey === 'account_1' ? acc1 : acc2

  if (!account.currentOtp || !account.otpExpiresAt) {
    throw new Error('Aucun code de vérification actif. Veuillez demander un nouveau code.')
  }

  if (new Date() > new Date(account.otpExpiresAt)) {
    throw new Error('Le code de vérification a expiré. Veuillez en demander un nouveau.')
  }

  if (String(account.currentOtp).trim() !== String(code).trim()) {
    throw new Error('Code de vérification incorrect.')
  }

  // Code valide : on le consomme
  account.currentOtp = null
  account.otpExpiresAt = null
  await account.save()

  // Token de session temporaire pour les opérations sensibles (ex: retrait)
  const sessionToken = `sec_${accountKey}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

  return {
    success: true,
    sessionToken,
    account: await getAccountDetails(accountKey),
  }
}

/**
 * Récupère le détail structuré et ventilé par catégorie d'un compte
 */
async function getAccountDetails(accountKey) {
  const { acc1, acc2 } = await AdminCoAccount.ensureAccounts()
  const account = accountKey === 'account_1' ? acc1 : acc2
  const shareStats = await getDynamicShareholdingStats()
  const myShareStats = accountKey === 'account_1' ? shareStats.compte1 : shareStats.compte2

  // Ventilation des gains par catégorie
  const categoriesBreakdown = {}
  for (const cat of Object.keys(CATEGORY_LABELS)) {
    categoriesBreakdown[cat] = {
      key: cat,
      label: CATEGORY_LABELS[cat],
      totalAmount: 0,
      totalPlatformAmount: 0,
      count: 0,
    }
  }

  for (const entry of account.ledger || []) {
    if (categoriesBreakdown[entry.category]) {
      categoriesBreakdown[entry.category].totalAmount += entry.accountShareAmount || 0
      categoriesBreakdown[entry.category].totalPlatformAmount += entry.totalPlatformAmount || 0
      categoriesBreakdown[entry.category].count += 1
    }
  }

  // Récents versements
  const recentLedger = [...(account.ledger || [])].reverse().slice(0, 50)
  // Récents retraits
  const recentWithdrawals = [...(account.withdrawals || [])].reverse()

  return {
    accountKey: account.accountKey,
    name: account.name,
    email: account.email,
    baseSharePercent: account.baseSharePercent,
    currentShareholding: myShareStats,
    globalExternalShares: shareStats.totalExternalShares,
    balance: Math.max(0, account.balance || 0),
    totalEarned: account.totalEarned || 0,
    totalWithdrawn: account.totalWithdrawn || 0,
    categories: Object.values(categoriesBreakdown),
    recentLedger,
    withdrawals: recentWithdrawals,
  }
}

/**
 * Enregistre un retrait pour l'un des comptes
 */
async function performAccountWithdrawal(accountKey, { amount, method = 'momo', phone = '', operator = '', accountName = '', notes = '', performedBy = '' }) {
  const amt = Math.round(Number(amount) || 0)
  if (!amt || amt <= 0) throw new Error('Montant de retrait invalide.')

  const { acc1, acc2 } = await AdminCoAccount.ensureAccounts()
  const account = accountKey === 'account_1' ? acc1 : acc2

  if (amt > account.balance) {
    throw new Error(`Solde insuffisant (${account.balance.toLocaleString('fr-FR')} FCFA disponible).`)
  }

  account.balance -= amt
  account.totalWithdrawn += amt

  const withdrawalRecord = {
    amount: amt,
    method,
    phone: phone || '',
    operator: operator || '',
    accountName: accountName || '',
    notes: notes || '',
    status: 'completed',
    withdrawnAt: new Date(),
    performedBy: performedBy || account.email,
  }

  account.withdrawals.push(withdrawalRecord)
  await account.save()

  // Notification par email du retrait
  try {
    await sendEmail({
      to: account.email,
      subject: `Confirmation de retrait : ${amt.toLocaleString('fr-FR')} FCFA`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 500px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h3 style="color: #16a34a; margin-top: 0;">Retrait validé avec succès</h3>
          <p>Un retrait de <b>${amt.toLocaleString('fr-FR')} FCFA</b> vient d'être effectué depuis votre compte administrateur (${account.name}).</p>
          <p><b>Mode :</b> ${method === 'momo' ? `Mobile Money (${operator.toUpperCase()} ${phone})` : 'Portefeuille'}</p>
          <p><b>Nouveau solde restant :</b> ${account.balance.toLocaleString('fr-FR')} FCFA</p>
        </div>
      `,
    })
  } catch (_) {}

  return {
    success: true,
    withdrawal: withdrawalRecord,
    newBalance: account.balance,
  }
}

/**
 * Récupère le résumé public/non déverrouillé des 2 comptes
 */
async function getAccountsSummary() {
  const { acc1, acc2 } = await AdminCoAccount.ensureAccounts()
  const shareStats = await getDynamicShareholdingStats()

  return {
    shareStats,
    accounts: [
      {
        accountKey: 'account_1',
        name: acc1.name || 'Compte 1 (60%)',
        email: acc1.email,
        baseSharePercent: acc1.baseSharePercent,
        currentSharePercent: shareStats.compte1.currentPercent,
        deductionPercent: shareStats.compte1.deductionPercent,
        totalWithdrawn: acc1.totalWithdrawn || 0,
      },
      {
        accountKey: 'account_2',
        name: acc2.name || 'Compte 2 (40%)',
        email: acc2.email,
        baseSharePercent: acc2.baseSharePercent,
        currentSharePercent: shareStats.compte2.currentPercent,
        deductionPercent: shareStats.compte2.deductionPercent,
        totalWithdrawn: acc2.totalWithdrawn || 0,
      },
    ],
  }
}

module.exports = {
  recordPlatformFee,
  sendAccountOtp,
  verifyAccountOtp,
  getAccountDetails,
  getAccountsSummary,
  getDynamicShareholdingStats,
  performAccountWithdrawal,
  CATEGORY_LABELS,
}
