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
  TrendingUp, Crown, Megaphone, CalendarClock, Video, Banknote, Receipt, Wallet,
  Lock, Sparkles, AlertCircle, ShieldAlert, Smartphone, History,
} from 'lucide-react'
import { shareholdersApi, paymentsApi, walletApi, zonesApi } from '../../lib/api'
import { useInlineCheckout } from '../../components/payments/useInlineCheckout'

const fmt = (n) => (Number(n) || 0).toLocaleString('fr-FR')
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
const POST_META = {
  depense: { label: 'Dépense', icon: Receipt, cls: 'bg-orange-100 text-orange-700' },
  paiement: { label: 'Somme à payer', icon: Banknote, cls: 'bg-red-100 text-red-700' },
  reunion: { label: 'Réunion', icon: CalendarClock, cls: 'bg-blue-100 text-blue-700' },
  info: { label: 'Info', icon: Megaphone, cls: 'bg-gray-100 text-gray-600' },
}
