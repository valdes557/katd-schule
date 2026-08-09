import {
  School, Info, BookOpen, Clock, Users, GraduationCap,
  UserCheck, UserCog, ClipboardList, FileText, CalendarCheck, Activity,
  Library, MessageSquare, Bell, FolderOpen, CreditCard, History, Receipt,
  BarChart2, LineChart, PieChart, UserPlus, MapPin, Globe, LayoutGrid, Shield, Wallet, QrCode,
  Bot, Sparkles, Image as ImageIcon, Briefcase, Newspaper, KeyRound,
  ArrowLeftRight, Coins, Store, Landmark,
} from 'lucide-react'

// roles: array of allowed roles. undefined = all roles.
// Source unique pour la navigation du dashboard (sidebar historique + grille de boutons ronds).
export const navSections = [
  {
    label: 'GESTION DE L\'ÉCOLE',
    roles: ['directeur'],
    items: [
      { label: "Profil de l'école", icon: School, path: '/dashboard/profil' },
      { label: 'Classes & Salles', icon: BookOpen, path: '/dashboard/classes' },
      { label: 'Matières & Programmes', icon: ClipboardList, path: '/dashboard/matieres' },
      { label: 'Emploi du temps', icon: Clock, path: '/dashboard/emploi-du-temps' },
      { label: 'Page de l\'école', icon: Globe, path: '/dashboard/page-ecole' },
    ],
  },
  {
    label: 'SUIVI SCOLAIRE',
    roles: ['parent'],
    items: [
      { label: 'Mes enfants', icon: GraduationCap, path: '/dashboard/parent/enfants' },
      { label: 'Notes & Bulletins', icon: FileText, path: '/dashboard/parent/notes' },
      { label: 'Bulletin trimestriel', icon: Receipt, path: '/dashboard/bulletin' },
      { label: 'Présence (mon enfant)', icon: CalendarCheck, path: '/dashboard/parent/presence' },
      { label: 'Présence de la classe', icon: Users, path: '/dashboard/parent/presence-classe' },
      { label: 'Discipline', icon: Shield, path: '/dashboard/parent/discipline' },
      { label: 'Devoirs assignés', icon: BookOpen, path: '/dashboard/parent/devoirs' },
      { label: 'Cours IA', icon: Bot, path: '/dashboard/ia-cours' },
      { label: 'Complétion devoirs', icon: ClipboardList, path: '/dashboard/parent/completion' },
      { label: 'Emploi du temps', icon: Clock, path: '/dashboard/parent/emploi-du-temps' },
      { label: 'Enseignants', icon: UserCheck, path: '/dashboard/parent/enseignants' },
      { label: 'Matières', icon: Library, path: '/dashboard/parent/matieres' },
      { label: 'Activités scolaires', icon: Activity, path: '/dashboard/parent/activites' },
      { label: 'Ressources pédagogiques', icon: Library, path: '/dashboard/parent/ressources' },
    ],
  },
  {
    label: 'FINANCES PARENTALES',
    roles: ['parent'],
    items: [
      { label: 'Frais & tranches', icon: Receipt, path: '/dashboard/parent/frais' },
      { label: 'Pension', icon: CreditCard, path: '/dashboard/parent/finances' },
      { label: 'Mon portefeuille', icon: Wallet, path: '/dashboard/portefeuille' },
      { label: 'Historique des paiements', icon: History, path: '/dashboard/paiements' },
      { label: 'Documents administratifs', icon: FolderOpen, path: '/dashboard/parent/documents' },
      { label: 'Rendez-vous', icon: CalendarCheck, path: '/dashboard/parent/rendez-vous' },
    ],
  },
  {
    label: 'CONTRÔLE PARENTAL',
    roles: ['parent'],
    items: [
      { label: 'Paramètres', icon: Shield, path: '/dashboard/parent/controles' },
    ],
  },
  {
    label: 'GESTION DES PERSONNES',
    roles: ['directeur'],
    items: [
      { label: 'Enseignants', icon: UserCheck, path: '/dashboard/enseignants' },
      { label: 'Élèves', icon: GraduationCap, path: '/dashboard/eleves' },
      { label: 'Inscriptions en ligne', icon: UserPlus, path: '/dashboard/inscriptions' },
      { label: 'Parents / Responsables', icon: Users, path: '/dashboard/parents' },
      { label: 'Personnel', icon: UserCog, path: '/dashboard/personnel' },
      { label: 'Membres administratifs', icon: Shield, path: '/dashboard/membres-admin', cycles: ['Secondaire'] },
      { label: 'QR de présence', icon: QrCode, path: '/dashboard/qr-presence', cycles: ['Secondaire'] },
      { label: 'Rapports reçus', icon: FileText, path: '/dashboard/rapports-recus', cycles: ['Secondaire'] },
      { label: 'Dossiers enseignants', icon: FolderOpen, path: '/dashboard/secretariat/dossiers', cycles: ['Secondaire'] },
      { label: 'Registre du courrier', icon: FileText, path: '/dashboard/secretariat/courrier', cycles: ['Secondaire'] },
      { label: 'Pointage du personnel', icon: QrCode, path: '/dashboard/pointage' },
      { label: 'Rapports de pointage', icon: BarChart2, path: '/dashboard/pointage/rapports' },
      { label: 'Gestion recrutement', icon: Briefcase, path: '/dashboard/recrutement' },
    ],
  },
  {
    label: 'MES CLASSES',
    roles: ['enseignant'],
    items: [
      { label: 'Mes élèves', icon: Users, path: '/dashboard/teacher/eleves' },
      { label: 'Classes & Salles', icon: BookOpen, path: '/dashboard/classes' },
      { label: 'Matières & Programmes', icon: ClipboardList, path: '/dashboard/matieres' },
      { label: 'Emploi du temps', icon: Clock, path: '/dashboard/emploi-du-temps' },
      { label: 'Rapports quotidiens', icon: FileText, path: '/dashboard/teacher/rapports' },
      { label: 'Mon pointage', icon: QrCode, path: '/dashboard/teacher/pointage' },
      { label: 'Mes salaires', icon: Wallet, path: '/dashboard/teacher/salaires' },
      { label: 'Mon portefeuille', icon: Wallet, path: '/dashboard/portefeuille' },
    ],
  },
  {
    label: 'GESTION PÉDAGOGIQUE',
    roles: ['directeur', 'enseignant'],
    items: [
      { label: 'Devoirs & Évaluations', icon: ClipboardList, path: '/dashboard/devoirs' },
      { label: 'Cahier de texte', icon: BookOpen, path: '/dashboard/cahier-de-texte' },
      { label: 'Cours IA', icon: Bot, path: '/dashboard/ia-cours' },
      { label: 'Notes & Bulletins', icon: FileText, path: '/dashboard/notes' },
      { label: 'Bulletins (PDF)', icon: Receipt, path: '/dashboard/bulletin' },
      { label: 'Présence', icon: CalendarCheck, path: '/dashboard/presence' },
      { label: 'Activités scolaires', icon: Activity, path: '/dashboard/activites' },
      { label: 'Ressources pédagogiques', icon: Library, path: '/dashboard/ressources' },
      { label: 'Gestion des répétitions', icon: GraduationCap, path: '/dashboard/repetitions', roles: ['enseignant'] },
      { label: 'Statistiques & Analytics', icon: BarChart2, path: '/dashboard/teacher/analytics', roles: ['enseignant'] },
    ],
  },
  {
    label: 'VIE SCOLAIRE (VICE-PRINCIPAL)',
    roles: ['vice_principal'],
    items: [
      { label: 'Emplois du temps', icon: Clock, path: '/dashboard/emploi-du-temps' },
      { label: 'Professeurs (classes & matières)', icon: UserCheck, path: '/dashboard/enseignants' },
      { label: 'Classes & Salles', icon: BookOpen, path: '/dashboard/classes' },
      { label: 'Matières & Programmes', icon: ClipboardList, path: '/dashboard/matieres' },
      { label: 'Suivi des devoirs', icon: ClipboardList, path: '/dashboard/devoirs' },
      { label: 'Cahier de texte', icon: BookOpen, path: '/dashboard/cahier-de-texte' },
      { label: 'Cours IA', icon: Bot, path: '/dashboard/ia-cours' },
      { label: 'Notes & examens', icon: FileText, path: '/dashboard/notes' },
      { label: 'Rendez-vous parents', icon: CalendarCheck, path: '/dashboard/rendez-vous-ecole' },
      { label: 'Rapports reçus', icon: FolderOpen, path: '/dashboard/rapports-recus' },
      { label: 'Mon portefeuille', icon: Wallet, path: '/dashboard/portefeuille' },
    ],
  },
  {
    label: 'SURVEILLANCE GÉNÉRALE',
    roles: ['surveillant_general'],
    items: [
      { label: 'Présences du jour', icon: CalendarCheck, path: '/dashboard/surveillance' },
      { label: 'Registre des visiteurs', icon: Users, path: '/dashboard/portier/visiteurs' },
      { label: 'Appels des professeurs', icon: ClipboardList, path: '/dashboard/presence' },
      { label: 'Permissions', icon: Bell, path: '/dashboard/permissions' },
      { label: 'Contacts parents', icon: Users, path: '/dashboard/contacts-parents' },
      { label: 'Mon portefeuille', icon: Wallet, path: '/dashboard/portefeuille' },
    ],
  },
  {
    label: 'CAISSE & FINANCES',
    roles: ['caissiere'],
    items: [
      { label: 'Pensions & Frais', icon: CreditCard, path: '/dashboard/director/pensions' },
      { label: 'Historique des paiements', icon: History, path: '/dashboard/paiements' },
      { label: 'Rapports financiers', icon: BarChart2, path: '/dashboard/rapports-financiers' },
      { label: 'Salaires (préparation)', icon: Wallet, path: '/dashboard/salaires' },
      { label: 'Factures', icon: Receipt, path: '/dashboard/factures' },
      { label: 'Mon portefeuille', icon: Wallet, path: '/dashboard/portefeuille' },
    ],
  },
  {
    label: 'SECRÉTARIAT',
    roles: ['secretaire'],
    items: [
      { label: 'Dossiers enseignants', icon: FolderOpen, path: '/dashboard/secretariat/dossiers' },
      { label: 'Registre du courrier', icon: FileText, path: '/dashboard/secretariat/courrier' },
      { label: 'Annonces', icon: Bell, path: '/dashboard/annonces' },
      { label: 'Documents partagés', icon: FolderOpen, path: '/dashboard/documents' },
      { label: 'Mes rapports', icon: FileText, path: '/dashboard/mes-rapports' },
      { label: 'Informations générales', icon: Info, path: '/dashboard/infos' },
      { label: 'Mon portefeuille', icon: Wallet, path: '/dashboard/portefeuille' },
    ],
  },
  {
    label: 'LOGE (PORTIER)',
    roles: ['portier'],
    items: [
      { label: 'Scanner un QR', icon: QrCode, path: '/dashboard/portier/scan' },
      { label: 'Entrées & sorties du jour', icon: CalendarCheck, path: '/dashboard/portier/journal' },
      { label: 'Registre des visiteurs', icon: Users, path: '/dashboard/portier/visiteurs' },
      { label: 'Permissions autorisées', icon: Bell, path: '/dashboard/permissions' },
      { label: 'Mon portefeuille', icon: Wallet, path: '/dashboard/portefeuille' },
    ],
  },
  {
    label: 'MON ESPACE ÉLÈVE',
    roles: ['eleve'],
    items: [
      { label: 'Mes notes', icon: FileText, path: '/dashboard/eleve/notes' },
      { label: 'Mon bulletin', icon: Receipt, path: '/dashboard/bulletin' },
      { label: 'Mon emploi du temps', icon: Clock, path: '/dashboard/eleve/emploi-du-temps' },
      { label: 'Mes devoirs', icon: ClipboardList, path: '/dashboard/eleve/devoirs' },
      { label: 'Cahier de texte', icon: BookOpen, path: '/dashboard/cahier-de-texte' },
      { label: 'Cours IA', icon: Bot, path: '/dashboard/ia-cours' },
      { label: 'Ma discipline', icon: Shield, path: '/dashboard/eleve/discipline' },
      { label: 'Mes paiements', icon: CreditCard, path: '/dashboard/eleve/paiements' },
      { label: 'Mon QR de présence', icon: QrCode, path: '/dashboard/eleve/mon-qr' },
      { label: 'Mon portefeuille', icon: Wallet, path: '/dashboard/portefeuille' },
    ],
  },
  {
    label: 'COMMUNICATION',
    roles: ['directeur', 'enseignant', 'parent', 'vice_principal', 'surveillant_general', 'caissiere', 'secretaire', 'portier', 'eleve'],
    items: [
      { label: 'Informations générales', icon: Info, path: '/dashboard/infos', roles: ['directeur', 'enseignant', 'parent', 'vice_principal', 'secretaire'] },
      { label: 'News & recrutement', icon: Newspaper, path: '/dashboard/news', roles: ['directeur', 'enseignant', 'parent'] },
      { label: 'Messenger', icon: MessageSquare, path: '/dashboard/messagerie' },
      { label: 'Annonces', icon: Bell, path: '/dashboard/annonces', roles: ['directeur', 'enseignant', 'parent', 'vice_principal', 'surveillant_general', 'secretaire', 'eleve'] },
      { label: 'Documents partagés', icon: FolderOpen, path: '/dashboard/documents', roles: ['directeur', 'enseignant', 'parent', 'vice_principal', 'secretaire'] },
      { label: 'Utilisateurs en ligne', icon: Activity, path: '/dashboard/suivi-connexions', roles: ['directeur', 'enseignant'] },
      { label: 'Social', icon: Globe, path: '/dashboard/social', roles: ['directeur', 'enseignant', 'parent', 'eleve'] },
      { label: 'Envoyer un rapport', icon: FileText, path: '/dashboard/mes-rapports', roles: ['enseignant', 'vice_principal', 'surveillant_general', 'caissiere', 'portier'] },
    ],
  },
  {
    label: 'ASSISTANT IA',
    roles: ['directeur', 'enseignant', 'parent'],
    items: [
      { label: 'Chat IA', icon: Bot, path: '/dashboard/ia-chat' },
      { label: 'Gestion IA', icon: Sparkles, path: '/dashboard/ia', roles: ['directeur'] },
    ],
  },
  {
    label: 'FINANCES & ABONNEMENTS',
    roles: ['directeur', 'super_admin'],
    items: [
      { label: 'Pensions & Frais', icon: CreditCard, path: '/dashboard/director/pensions', roles: ['directeur'] },
      { label: 'Historique des paiements', icon: History, path: '/dashboard/paiements' },
      { label: 'Salaires', icon: Wallet, path: '/dashboard/salaires', roles: ['directeur'] },
      { label: 'Factures', icon: Receipt, path: '/dashboard/factures' },
      { label: 'Souscriptions', icon: CreditCard, path: '/dashboard/souscriptions' },
      { label: 'Mon portefeuille', icon: Wallet, path: '/dashboard/portefeuille', roles: ['directeur'] },
    ],
  },
  {
    label: 'RAPPORTS & STATISTIQUES',
    roles: ['directeur'],
    items: [
      { label: 'Rapports des enseignants', icon: FileText, path: '/dashboard/rapports' },
      { label: 'Rapports', icon: LineChart, path: '/dashboard/rapports/detail' },
      { label: 'Statistiques', icon: PieChart, path: '/dashboard/statistiques' },
    ],
  },
  {
    label: 'ADMINISTRATION',
    roles: ['super_admin'],
    items: [
      { label: 'Écoles', icon: School, path: '/dashboard/ecoles-admin' },
      { label: 'Demandes d\'écoles', icon: UserPlus, path: '/dashboard/demandes-ecoles' },
      { label: 'Matières par école', icon: ClipboardList, path: '/dashboard/matieres-ecoles' },
      { label: 'Localités (Pays/Villes)', icon: MapPin, path: '/dashboard/localites' },
      { label: 'Gestion Plateforme', icon: LayoutGrid, path: '/dashboard/plateforme' },
      { label: 'Gestion API (Paiements)', icon: KeyRound, path: '/dashboard/plateforme?tab=api' },
      { label: 'Gestion des utilisateurs', icon: UserCog, path: '/dashboard/utilisateurs-admin' },
      { label: 'Gestion des marchands', icon: Store, path: '/dashboard/marchands-admin' },
      { label: 'Gestion des actionnaires', icon: Landmark, path: '/dashboard/actionnaires-admin' },
      { label: 'Gestion des transactions', icon: ArrowLeftRight, path: '/dashboard/transactions-admin' },
      { label: 'Frais de transaction', icon: Coins, path: '/dashboard/frais-transaction-admin' },
      { label: 'Bannières', icon: ImageIcon, path: '/dashboard/bannieres' },
      { label: 'Assistant IA', icon: Bot, path: '/dashboard/ia-admin' },
      { label: 'Suivi des connexions', icon: Activity, path: '/dashboard/suivi-connexions' },
    ],
  },
]

// Renvoie les sections + items visibles pour l'utilisateur courant (filtrage rôle + cycle directeur).
export function getVisibleSections(user, school) {
  const role = user?.role
  const isDirecteur = role === 'directeur'
  const subscribedCycle = isDirecteur && school?.subscription?.cycle ? school.subscription.cycle : null
  const schoolCycles = subscribedCycle ? [subscribedCycle] : (school?.cycles || [])

  return navSections
    .filter((s) => !s.roles || s.roles.includes(role))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.roles && !item.roles.includes(role)) return false
        if (item.cycles && isDirecteur && schoolCycles.length > 0 && !item.cycles.some((c) => schoolCycles.includes(c))) return false
        return true
      }),
    }))
    .filter((section) => section.items.length > 0)
}