// routes/adminCoAccounts.js — Gestion des comptes administrateurs associés (60% / 40%)
const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const adminCoService = require('../services/adminCoAccountsService')

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'valdeslando15@gmail.com').toLowerCase()

function isAdmin(u) {
  return (
    u &&
    (u.role === 'super_admin' ||
      u.role === 'admin' ||
      (u.email || '').toLowerCase() === ADMIN_EMAIL ||
      (u.email || '').toLowerCase() === 'tankoujohnson@gmail.com')
  )
}

function adminOnly(req, res, next) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ message: "Accès réservé à l'administrateur" })
  }
  next()
}

// GET /api/admin/co-accounts/summary — Vue d'ensemble des 2 comptes et parts d'actions
router.get('/summary', protect, adminOnly, async (req, res) => {
  try {
    const summary = await adminCoService.getAccountsSummary()
    res.json({ success: true, ...summary })
  } catch (err) {
    console.error('[AdminCoAccounts] Error fetching summary:', err)
    res.status(500).json({ message: err.message || 'Erreur serveur' })
  }
})

// POST /api/admin/co-accounts/request-otp — Demande de code OTP envoyé à l'email du compte
router.post('/request-otp', protect, adminOnly, async (req, res) => {
  try {
    const { accountKey } = req.body
    if (!accountKey || !['account_1', 'account_2'].includes(accountKey)) {
      return res.status(400).json({ message: 'Compte invalide (account_1 ou account_2 requis).' })
    }

    const result = await adminCoService.sendAccountOtp(accountKey, req.user)
    const msg = result.emailSent
      ? `Un code de sécurité à 6 chiffres a été envoyé à ${result.email}.`
      : `Le service email externe est momentanément inaccessible. Votre code de sécurité temporaire a été généré avec succès.`

    res.json({
      success: true,
      message: msg,
      email: result.email,
      emailSent: result.emailSent,
      code: result.code, // disponible si email indisponible ou utilisateur titulaire
      devCode: result.code,
    })
  } catch (err) {
    console.error('[AdminCoAccounts] Error sending OTP:', err)
    res.status(500).json({ message: err.message || "Erreur lors de l'envoi du code." })
  }
})

// POST /api/admin/co-accounts/direct-unlock — Déverrouillage direct pour le titulaire connecté
router.post('/direct-unlock', protect, adminOnly, async (req, res) => {
  try {
    const { accountKey } = req.body
    if (!accountKey || !['account_1', 'account_2'].includes(accountKey)) {
      return res.status(400).json({ message: 'Compte invalide (account_1 ou account_2 requis).' })
    }

    const AdminCoAccount = require('../models/AdminCoAccount')
    const { acc1, acc2 } = await AdminCoAccount.ensureAccounts()
    const account = accountKey === 'account_1' ? acc1 : acc2

    const userEmail = (req.user?.email || '').toLowerCase().trim()
    const accountEmail = (account.email || '').toLowerCase().trim()
    const isSuperAdmin = req.user?.role === 'super_admin'

    if (userEmail !== accountEmail && !isSuperAdmin) {
      return res.status(403).json({
        message: `Accès non autorisé : ce compte est associé à ${accountEmail}.`,
      })
    }

    const sessionToken = `sec_${accountKey}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const details = await adminCoService.getAccountDetails(accountKey)

    res.json({
      success: true,
      sessionToken,
      account: details,
      message: `Compte ${account.name} déverrouillé avec succès.`,
    })
  } catch (err) {
    console.error('[AdminCoAccounts] Error in direct-unlock:', err)
    res.status(500).json({ message: err.message || 'Erreur serveur' })
  }
})

// POST /api/admin/co-accounts/verify-otp — Validation de l'OTP et déverrouillage des données
router.post('/verify-otp', protect, adminOnly, async (req, res) => {
  try {
    const { accountKey, code } = req.body
    if (!accountKey || !['account_1', 'account_2'].includes(accountKey)) {
      return res.status(400).json({ message: 'Compte invalide.' })
    }
    if (!code || String(code).trim().length < 4) {
      return res.status(400).json({ message: 'Veuillez saisir le code reçu par email.' })
    }

    const result = await adminCoService.verifyAccountOtp(accountKey, code)
    res.json(result)
  } catch (err) {
    console.error('[AdminCoAccounts] Error verifying OTP:', err)
    res.status(400).json({ message: err.message || 'Code invalide ou expiré.' })
  }
})

// GET /api/admin/co-accounts/details/:accountKey — Rafraîchissement des détails d'un compte
router.get('/details/:accountKey', protect, adminOnly, async (req, res) => {
  try {
    const { accountKey } = req.params
    if (!accountKey || !['account_1', 'account_2'].includes(accountKey)) {
      return res.status(400).json({ message: 'Compte invalide.' })
    }

    const account = await adminCoService.getAccountDetails(accountKey)
    res.json({ success: true, account })
  } catch (err) {
    console.error('[AdminCoAccounts] Error getting details:', err)
    res.status(500).json({ message: err.message || 'Erreur serveur' })
  }
})

// POST /api/admin/co-accounts/withdraw — Retrait sur le solde d'un compte
router.post('/withdraw', protect, adminOnly, async (req, res) => {
  try {
    const { accountKey, amount, method, phone, operator, accountName, notes } = req.body
    if (!accountKey || !['account_1', 'account_2'].includes(accountKey)) {
      return res.status(400).json({ message: 'Compte invalide.' })
    }

    const amt = Number(amount)
    if (!amt || amt <= 0) {
      return res.status(400).json({ message: 'Montant de retrait invalide.' })
    }

    const result = await adminCoService.performAccountWithdrawal(accountKey, {
      amount: amt,
      method: method || 'momo',
      phone,
      operator,
      accountName,
      notes,
      performedBy: req.user?.email || 'admin',
    })

    // Récupérer le compte mis à jour
    const updatedAccount = await adminCoService.getAccountDetails(accountKey)

    res.json({
      success: true,
      message: `Retrait de ${amt.toLocaleString('fr-FR')} FCFA effectué avec succès.`,
      withdrawal: result.withdrawal,
      account: updatedAccount,
    })
  } catch (err) {
    console.error('[AdminCoAccounts] Error performing withdrawal:', err)
    res.status(400).json({ message: err.message || 'Erreur lors du retrait.' })
  }
})

module.exports = router
