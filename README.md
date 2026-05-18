# 🏫 KATD-SCHÜLE
**Apprendre, Partager, Grandir** — Plateforme scolaire multi-établissements.

Espace public (vitrine multimédia) + Tableau de bord privé (gestion complète).

---

## 🛠 Stack
- **Front** : React 18 · Vite · TailwindCSS · Recharts · Lucide
- **Back** : Node.js · Express · MongoDB (Atlas) · JWT · Mongoose
- **Déploiement** : Vercel (front) + Render (back)

---

## 🚀 Démarrage local

### 1. Cloner
```bash
git clone https://github.com/<votre-user>/katd-schule.git
cd katd-schule
```

### 2. Backend
```bash
cd server
npm install
cp .env.example .env
# → éditer MONGO_URI, JWT_SECRET, etc.
npm run seed     # Crée les comptes démo dans MongoDB
npm run dev      # http://localhost:5000
```

### 3. Frontend
```bash
cd client
npm install
cp .env.example .env
npm run dev      # http://localhost:5173
```

---

## 🔑 Comptes de démonstration

Après `npm run seed` côté serveur, ces comptes sont actifs en base :

| Rôle | Email | Mot de passe | Accès |
|------|-------|--------------|-------|
| 🛡️ Super Admin | `admin@katdschule.com` | `admin123` | Toutes les écoles |
| 👩‍💼 Directrice | `directeur@ecole.ci` | `demo123` | Dashboard complet |
| 👨‍🏫 Enseignant | `enseignant@ecole.ci` | `demo123` | Notes, présence, classes |
| 👨‍👩‍👧 Parent | `parent@ecole.ci` | `demo123` | Suivi élèves |
| 🎒 Élève | `eleve@ecole.ci` | `demo123` | Bulletins, ressources |

> 💡 Si l'API est injoignable, le client bascule automatiquement en **mode démo offline** avec ces mêmes comptes (sans persistance MongoDB).

---

## 🌐 Déploiement

### Backend → Render

1. Push le repo sur GitHub.
2. Sur [render.com](https://render.com) → **New → Blueprint** → connecte le repo (le `render.yaml` est détecté automatiquement).
3. Renseigne les variables d'env dans le dashboard Render :
   - `MONGO_URI` = `mongodb+srv://...mongodb.net/katd_schule?retryWrites=true&w=majority`
   - `JWT_SECRET` = chaîne aléatoire (64+ caractères)
   - `CLIENT_URL` = `https://<votre-app>.vercel.app` (séparer plusieurs URL par virgules)
4. Deploy → l'API est dispo sur `https://katd-schule-api.onrender.com`.
5. (1 fois) Lance le seed via Render Shell : `npm run seed`.

### Frontend → Vercel

1. Sur [vercel.com](https://vercel.com) → **Add New Project** → import du repo.
2. **Root Directory** : `client`
3. Framework détecté : **Vite** (le `vercel.json` gère les rewrites SPA).
4. Variable d'env :
   - `VITE_API_URL` = `https://katd-schule-api.onrender.com/api`
5. Deploy.

### CI/CD automatique
Chaque `git push` sur `main` redéploie front + back automatiquement.

---

## 📁 Structure

```
katd-schule/
├── client/                      # Front React
│   ├── src/
│   │   ├── pages/               # Toutes les pages
│   │   ├── components/layout/   # Sidebar, Headers, Footer
│   │   ├── context/             # AuthContext
│   │   ├── data/                # Données mock
│   │   └── lib/                 # api.js, utils
│   └── vercel.json
├── server/                      # API Express
│   ├── config/db.js
│   ├── models/                  # User, School, Student, Media
│   ├── routes/                  # auth, schools, students, media
│   ├── middleware/auth.js
│   ├── scripts/seed.js          # ← npm run seed
│   └── server.js
├── render.yaml                  # Blueprint Render
└── README.md
```

---

## 🌐 Pages

### Public
| Route | Description |
|-------|-------------|
| `/` | Vitrine — landing professionnelle |
| `/explorer` | Grille de contenus filtrables |
| `/ecoles` | Annuaire des écoles |
| `/login` | Connexion |

### Dashboard (auth requise)
| Route | Description |
|-------|-------------|
| `/dashboard` | KPI, charts, activités, événements |
| `/dashboard/eleves` | Tableau + filtres + ajout |
| `/dashboard/enseignants` | Cartes profs |
| `/dashboard/notes` | Saisie notes + statistiques + bulletins |
| `/dashboard/presence` | Appel digital + historique |
| `/dashboard/messagerie` | Inbox + conversations |
| `/dashboard/souscriptions` | Abonnements & paiements |

---

## 📡 API REST

```
POST   /api/auth/register       Inscription
POST   /api/auth/login          Connexion
GET    /api/auth/me             Profil courant

GET    /api/schools             Liste publique des écoles
GET    /api/schools/:id         Détail
POST   /api/schools             (super_admin)

GET    /api/students            Élèves de mon école
POST   /api/students
PUT    /api/students/:id
DELETE /api/students/:id

GET    /api/media               Vitrine publique (filtres : type, school, category, sort)
POST   /api/media               Upload (multipart)
PUT    /api/media/:id/like
DELETE /api/media/:id

GET    /api/health              Healthcheck
```

---

## 💳 Tarifs

| Cycle | Trimestriel | Annuel |
|-------|------------:|-------:|
| Maternelle | 12 000 F CFA | 35 000 F CFA |
| Primaire | 15 000 F CFA | 40 000 F CFA |
| Secondaire | 20 000 F CFA | 55 000 F CFA |

Paiements supportés : Mobile Money (MTN/Orange), Wave, Stripe, PayPal.

---

## 📄 Licence
© 2024 KATD-SCHÜLE — Tous droits réservés.
