
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

- ⬜ A1. Modèle `TeacherFile` (dossier enseignant) : pièces jointes, statut `recu → verifie → transmis → valide/rejete`, transmission au Principal (directeur)
- ⬜ A2. Routes `/api/teacher-files` (CRUD + workflow statuts, authorize secretaire/directeur)
- ⬜ A3. Page `SecretaireDossiersPage` : réception, vérification (checklist pièces), transmission
- ⬜ A4. Modèle `Mail` (courrier) : entrant/sortant, expéditeur, objet, catégorie, pièce scannée, statut archivé
- ⬜ A5. Routes `/api/mails` + page `SecretaireCourrierPage` (réception, classement, archivage, recherche)
- ⬜ A6. Publication d'annonces par la secrétaire (extension `announcements` : authorize secretaire, champ `onBehalfOf` Direction)
- ⬜ A7. Documents : upload/scan (Cloudinary), archivage par catégorie, impression (vue print), téléchargement

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

- ⬜ D1. Notifications automatiques : déclencheurs serveur sur Absence/Retard (EntryAttendance + Attendance), Sanction, Note publiée, Paiement reçu, Annonce → `Notification` + push + badge in-app
- ⬜ D2. Vue Discipline par enfant
- ⬜ D3. Solde des frais par enfant (déjà partiel dans ParentFinancesPage — compléter)

## PHASE E — Dashboard Portier

- ⬜ E1. Modèle `Visitor` : nom, motif, personne visitée, heure entrée/sortie, pièce d'identité
- ⬜ E2. Routes `/api/visitors` + page `PortierVisitorsPage` (enregistrement + journal)
- ⬜ E3. Alertes auto : retard (déjà calculé `lateMinutes`) → notification SG + parent ; QR inconnu/invalide → alerte "accès non autorisé" au SG
- ⬜ E4. Transmission auto au Surveillant Général : le journal du jour + alertes remontent dans `/dashboard/surveillance`

## PHASE F — Transversal

- ✅ F1. **Wallet pour tous** : création auto du wallet à la création de tout compte (hook post-save `User.js`) + script de rattrapage `server/scripts/backfillWallets.js` (25 wallets créés le 2026-08-03) + lien "Mon portefeuille" ajouté aux menus élève, VP, SG, secrétaire, portier
- ⬜ F2. **IA enseignante autonome** : mode "Cours" en plus du chat — l'élève choisit matière/niveau/chapitre, l'IA déroule une leçon structurée (explication → exemples → exercices → correction), suivi de progression (`AiLessonProgress`), aligné sur `Subject.program`
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
