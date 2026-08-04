# PLAN — FRAIS & PENSION (PRIMAIRE) : ÉDITION, REMISES, REÇUS PDF

> Enregistré le 2026-08-04.
> Légende : ✅ fait · 🔄 en cours · ⬜ à faire

## Contexte

Côté primaire, le directeur pouvait attribuer des frais de pension aux élèves mais **pas les modifier ni les supprimer** depuis l'UI. Aucune notion de **remise/réduction** n'existait, et le **reçu PDF** était très basique. Ce lot ajoute ces trois capacités.

## Décisions produit

- Remise **par frais précis** (pas globale sur l'élève).
- Remise en **montant fixe (F CFA) OU pourcentage (%)**, avec **motif obligatoire**.
- Les concernés (parent, élève) voient la remise et le net à payer ; un **total des réductions** est affiché.

---

## PHASE 1 — Modèle de données

- ✅ 1.1 `server/models/Fee.js` : champ `discount { type: 'fixed'|'percentage', value, amount (calculé, stocké), reason, date, grantedBy }`
- ✅ 1.2 Méthode `netAmount()` + virtual `net` + `toJSON/toObject { virtuals: true }`
- ✅ 1.3 Hook `pre('save')` : recalcul du `status` (paid/partial/pending) sur le **net** quand `paid`/`amount`/`discount` changent (remise 100 % → `paid`)

## PHASE 2 — Backend endpoints & sécurité

- ✅ 2.1 `POST /api/fees/:id/discount` : validations (type, valeur > 0, % ≤ 100, motif obligatoire, remise ≤ montant), notif push/email parent
- ✅ 2.2 `DELETE /api/fees/:id/discount` : retrait de la remise (status recalculé)
- ✅ 2.3 `PUT /api/fees/:id` sécurisé : **whitelist** des champs, rejet `amount < paid`, recalcul remise % si le montant change
- ✅ 2.4 `client/src/lib/api.js` : `feesApi.setDiscount` / `feesApi.removeDiscount`

## PHASE 3 — Recalculs nets (tous les points de calcul)

- ✅ 3.1 Helper `netOf(f)` dans `fees.js`
- ✅ 3.2 `GET /payment-status` : `totalDue`/`remaining` nets, `totalDiscount`, `discount`+`netAmount`+`type/dueDate/term/academicYear` par frais
- ✅ 3.3 `GET /payment-history` : `totalDue` net, `totalDiscount`, tableau `discounts[]`, `summary.totalDiscount`
- ✅ 3.4 `record-payment` & `pay-wallet` : `remaining` net, **cap tranche** `min(inst.amount, remaining)`, status via pre-save, textes « Reste » nets
- ✅ 3.5 `parent.js` : aggregate dashboard `$subtract`/`$ifNull`, `children/:id` net + `discount`, `GET /fees` net + `totalDiscount`, legacy pay validé
- ✅ 3.6 `students.js` `GET /me/fees` (`.lean()`) : `netAmount` calculé manuellement + `totalDiscount`

## PHASE 4 — Frontend directeur

- ✅ 4.1 `DirectorFeesPage` : boutons **Modifier** (Pencil, réutilise la modale de création en mode édition), **Supprimer** (Trash2 + confirmation), **Remise** (BadgePercent)
- ✅ 4.2 Modale remise : type fixe/%, valeur, motif requis, aperçu live du net, **retrait** de remise
- ✅ 4.3 Affichage : badge remise + montant original barré / net, ligne « Remises » dans l'en-tête élève

## PHASE 5 — Frontend parent / élève / caissière

- ✅ 5.1 `PaymentHistoryPage` (directeur) : carte « Remises accordées », remise par élève, bloc « Réductions accordées » (motif + date) dans le détail
- ✅ 5.2 `PaymentHistoryPage` (parent) : calculs nets + remise affichée
- ✅ 5.3 `ParentFinancesPage` : totaux nets, remise par enfant/par frais, `PayWalletModal` reste net
- ✅ 5.4 Secondaire : `CaissiereReportsPage` (sommes nettes), `ElevePaiementsPage` (netAmount + remise)

## PHASE 6 — Design du reçu PDF (pdfkit)

- ✅ 6.1 `renderReceiptPdf()` : bandeau bleu + logo école (best-effort), encadrés Élève/Paiement
- ✅ 6.2 Tableau récapitulatif zébré avec **ligne remise** + « Net à payer »
- ✅ 6.3 Bandeau de statut (soldé / partiel), pied de page + cadre signature

## PHASE 7 — Livraison

- ✅ 7.1 Vérification syntaxe backend + build client
- ✅ 7.2 Commits par fonctionnalité + `git push origin main`

---

## Vérification manuelle

1. Directeur : créer → modifier → supprimer un frais.
2. Remise 10 % (motif « Bourse ») → net visible partout ; payer le net → `paid` ; retirer la remise → `partial`.
3. Validations : sans motif / remise > montant / % > 100 → 400.
4. Parent : remise + reste net ; reçu PDF (bandeau, tableau, ligne remise, statut) ; école sans logo.
5. Régression : frais sans remise → montants identiques à avant.
