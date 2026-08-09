

# PLAN DE TRAVAIL — MODULE SECONDAIRE KATD-SCHÜLE

> Enregistré le 2026-08-03. Cahier des charges : dashboards Secrétaire, Professeur, Élève, Parent, Portier + fonctionnalités communes.
> Légende : ✅ fait · 🔄 en cours · ⬜ à faire

## État des lieux (existant)

- ✅ Rôles secondaire : vice_principal, surveillant_general, caissiere, secretaire, portier (`server/models/User.js`)
- ✅ Scan QR entrées/sorties portier (`EntryAttendance`, `PortierScanPage`, `PresenceQrPage`)
- ✅ Permissions sortie/absence/retard (`PermissionRequest`, `PermissionsPage`)
- ✅ Rapports internes vers Directeur/VP (`Report`, `ReportsPage`)
- ✅ Notes, devoirs, emploi du temps, annonces, documents, RDV
- ✅ Wallet + transactions + Mobile Money SEBPay
- ✅ Katd Messenger (texte, vocal, image, vidéo)
- ✅ IA chat OpenAI avec quotas/souscriptions (`server/routes/ai.js`)
- ✅ Infra notifications push (`web-push`, `PushSubscription`)

---

## PHASE A — Dashboard Secrétaire

- ✅ A1. Modèle `TeacherFile` (dossier enseignant) : pièces jointes avec checklist, statut `recu → verifie → transmis → valide/rejete`, historique du workflow
- ✅ A2. Routes `/api/teacher-files` (CRUD + upload pièces Cloudinary + workflow statuts, authorize secretaire/directeur, push transmission/décision)
- ✅ A3. Page `SecretaireDossiersPage` (`/dashboard/secretariat/dossiers`) : réception, checklist pièces, transmission, validation/rejet par le principal — menus secrétaire + directeur
- ✅ A4. Modèle `Mail` (courrier) : entrant/sortant, correspondant, objet, catégorie, référence, pièce scannée, statut archivé
- ✅ A5. Routes `/api/mails` + page `SecretaireCourrierPage` (`/dashboard/secretariat/courrier`) : réception, classement par catégorie, archivage, recherche
- ✅ A6. Publication d'annonces par la secrétaire : déjà autorisée (announcements.js) + champ `onBehalfOf` "La Direction" ajouté et affiché
- ✅ A7. Documents : upload/scan Cloudinary + archivage par catégorie déjà couverts par `/dashboard/documents` (secrétaire autorisée) ; pièces scannées dans dossiers + courrier

## PHASE B — Dashboard Professeur

- ✅ B1. Appel de classe via QR : bouton "Appel par QR" dans `PresencePage` (caméra html5-qrcode), route `POST /api/attendance/resolve-qr` (vérifie classe du prof + école), scan → présent, non scannés → absents
- ✅ B2. Workflow notes : champ `status` (`brouillon`/`publie`) sur `Grade`, prof modifie/supprime uniquement ses brouillons, `PUT /api/grades/publish/batch` publie en lot + notifie les parents, élèves/parents/bulletin ne voient que les notes publiées
- ✅ B3. Modèle `LessonLog` (cahier de texte) : classe, matière, date/créneau, titre leçon, contenu, devoirs donnés, visa VP/directeur
- ✅ B4. Routes `/api/lesson-logs` + page `LessonLogPage` (`/dashboard/cahier-de-texte`) : prof remplit/modifie, VP/directeur visent, élève/parent lecture seule (menus prof, VP, directeur, élève)
- ✅ B5. Restriction stricte : classes déjà scopées (classes.js), notes scopées (grades.js), devoirs → contrôle classe assignée ajouté dans `POST /teacher/homeworks`, appel QR contrôlé

## PHASE C — Dashboard Élève

- ✅ C1. Vue Discipline : `GET /api/students/me/discipline` (retards portier, absences/retards en classe, permissions) + page `/dashboard/eleve/discipline`
- ✅ C2. Vue Paiements : `GET /api/students/me/fees` (frais, payé, solde, tranches) + page `/dashboard/eleve/paiements` (lecture seule)
- ✅ C3. Bulletin PDF : rôle `eleve` autorisé sur `/grades/bulletin/:id` (uniquement SA fiche) + BulletinPage résout le studentId via `myProfile()` + lien "Mon bulletin" au menu
- ✅ C4. Consultation cahier de texte de sa classe (fait en B4)

## PHASE D — Dashboard Parent

- ✅ D1. Notifications automatiques : push parent sur Absence/Retard en classe (attendance.js), Entrée/Sortie/Retard portier (entryAttendance.js), Note publiée (grades.js), Paiement reçu (fees.js), Permission décidée (permissions.js) ; Annonces déjà couvertes (announcements.js)
- ✅ D2. Vue Discipline par enfant : `GET /api/students/:id/discipline` (parent = ses enfants ; direction = école) + composant partagé `DisciplineView` + page `/dashboard/parent/discipline` (sélecteur d'enfant) + menu parent
- ✅ D3. Solde des frais par enfant : ParentFinancesPage — total/payé/solde affichés dans l'en-tête de chaque enfant

## PHASE E — Dashboard Portier

- ✅ E1. Modèle `Visitor` : nom, téléphone, pièce d'identité (type + n°), motif, personne visitée, heure entrée/sortie, enregistré par
- ✅ E2. Routes `/api/visitors` (create, checkout, journal filtrable) + page `PortierVisitorsPage` (`/dashboard/portier/visiteurs`) : enregistrement + pointage sortie + journal — menus portier et SG
- ✅ E3. Alertes auto : retard → push SG (déjà) + parent (D1) ; QR inconnu/autre établissement → alerte "accès non autorisé" aux SG + principal
- ✅ E4. Transmission au Surveillant Général : onglet "Visiteurs" ajouté à `/dashboard/surveillance` (journal du jour du portier + entrées/sorties déjà visibles)

## PHASE F — Transversal

- ✅ F1. **Wallet pour tous** : création auto du wallet à la création de tout compte (hook post-save `User.js`) + script de rattrapage `server/scripts/backfillWallets.js` (25 wallets créés le 2026-08-03) + lien "Mon portefeuille" ajouté aux menus élève, VP, SG, secrétaire, portier
- ✅ F2. **IA enseignante autonome** — le prof prépare, l'IA enseigne en direct :
  - ✅ F2.1 Le professeur ajoute le cours **par PDF ou par écrit** (modèle `AiCourse` : classe, matière, titre, contenu texte ou PDF avec extraction du texte via `pdf-parse` dans `aiCourseService`)
  - ✅ F2.2 Le professeur **programme l'heure de début et la durée d'exécution** du cours (route `POST /api/ai-courses`, page `AiCoursesPage`, contrôle « SES classes assignées »)
  - ✅ F2.3 L'IA enseignante **respecte la ponctualité** : pré-génération du déroulé à T-5 min + démarrage/fin automatiques à l'heure via `jobs/aiCourseRunner` (tick 45 s, `startedAt = scheduledAt` pour ne jamais décaler)
  - ✅ F2.4 L'IA **écrit au fur et à mesure** : révélation progressive pure calée sur l'horloge serveur (`revealedText`), page `AiCourseLivePage` avec polling + curseur clignotant, identique pour tous les spectateurs
  - ✅ F2.5 À la **fin du cours**, les élèves posent leurs **questions** et l'IA **répond après chaque question** (`POST /api/ai-courses/:id/questions`, 3 max/élève, quota IA)
  - ✅ F2.6 Suivi : transcript conservé (`lessonScript` + `questions`), relecture par les élèves de la classe (statut `termine` → révélation totale)
- ⬜ F3. Journal des actions/logs (modèle `AuditLog` + middleware sur actions sensibles)
- ⬜ F4. Notifications temps réel généralisées (brancher pushService sur tous les événements)
- ⬜ F5. Export PDF/Excel généralisé (bulletins, journaux, rapports financiers)
- ⬜ F6. Vérif responsive mobile/tablette de toutes les nouvelles pages

---

## Ordre de réalisation proposé

1. **F1** Wallet pour tous (fondation, rapide)
2. **B1–B5** Professeur (cœur pédagogique : appel QR, notes avec validation, cahier de texte)
3. **C1–C4** Élève (consomme ce que produit le prof)
4. **D1–D3** Parent (notifications auto = valeur immédiate)
5. **E1–E4** Portier (visiteurs + alertes)
6. **A1–A7** Secrétaire (dossiers + courrier)
7. **F2** IA enseignante autonome
8. **F3–F6** Logs, exports, responsive

## Journal d'avancement

| Date | Tâche | Statut |
|---|---|---|
| 2026-08-03 | Plan enregistré | ✅ |
| 2026-08-03 | F1 Wallet pour tous (hook + backfill + menus) | ✅ |
| 2026-08-03 | B1 Appel par QR · B2 Workflow notes · B3-B4 Cahier de texte · B5 Restrictions prof | ✅ |
| 2026-08-03 | C1 Discipline · C2 Paiements · C3 Bulletin PDF élève | ✅ |
| 2026-08-04 | D1 Notifications push parent · D2 Discipline par enfant · D3 Solde frais par enfant | ✅ |
| 2026-08-04 | E1-E2 Registre visiteurs · E3 Alertes QR invalide · E4 Onglet visiteurs surveillance | ✅ |
| 2026-08-04 | A1-A3 Dossiers enseignants · A4-A5 Courrier · A6 onBehalfOf annonces · A7 Documents | ✅ |
| 2026-08-09 | F2 IA enseignante autonome (modèle AiCourse, service+quota, runner ponctuel, routes, pages Cours IA + Live, menus prof/élève/parent/VP/directeur) | ✅ |
