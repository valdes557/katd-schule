# PLAN-YOUTUBE — ▶ YouTube dans l'espace utilisateur (bouton « Vidéos »)

Le bouton **Vidéos** de l'espace `/u` (`/u/videos` → `UserVideosPage`) est enrichi : il permet de
**rechercher et regarder de vraies vidéos YouTube dans KATD** (lecteur intégré officiel, jamais de
redirection), via l'**API YouTube Data v3**. Deux onglets : **YouTube** (nouveau, par défaut) et
**KATD** (vidéos plateforme, comportement actuel conservé).

Construit sur l'existant, **sans dépendance npm** (Node `fetch` global). Le spec supposait
shadcn/Zod/Helmet/React Query/Redis — **absents** → Tailwind + lucide + `fetch` (`lib/api.js`) +
cache mémoire + rate-limit ciblé + validation manuelle.

## Sécurité de la clé API (non négociable)
- Clé **uniquement côté serveur** : `YoutubeConfig` (chiffrée AES‑256‑GCM via `utils/crypto`) OU
  `process.env.YOUTUBE_API_KEY`. **Jamais** envoyée au navigateur, **jamais** loggée.
- Toutes les requêtes YouTube passent par `/api/youtube/*` (auth `protect`).
- Insertion **directe** par le super admin (collage), affichage **masqué**.

## Backend
- **Modèles** : `YoutubeConfig` (singleton : `apiKey` chiffrée, `cacheTtl`, `maxSearchLen`, `enabled`) ;
  `YouTubeFavorite` (user, youtubeVideoId, title, thumbnail, channelTitle ; index unique user+video) ;
  `YouTubeHistory` (…, watchedAt ; borné ~100/user). `SchoolPost` : + type `youtube` + `youtubeVideoId`/`channelTitle`.
- **`youtubeService`** : `resolveApiKey()` (DB→env), **cache mémoire TTL** (anti‑quota), `search` (search.list
  + videos.list pour durée/vues), `videoDetails`, `related` (repli recherche par titre — `relatedToVideoId`
  déprécié), `categories` (liste serveur). Détection `403 quotaExceeded/keyInvalid` → message générique.
- **Routes `/api/youtube`** (toutes `protect`) : `GET /search` (rate‑limité + validation `q`), `GET /videos/:id`,
  `GET /related/:id`, `GET /categories`, `GET|POST /favorites`, `DELETE /favorites/:videoId`,
  `GET|POST|DELETE /history`, `POST /share` (crée un `SchoolPost` type youtube).
- **Admin** (`walletAdmin.js`, super_admin) : `GET /api/admin/youtube` (clé masquée), `PUT /api/admin/youtube`
  (colle la clé → chiffrée + réglages).
- **Mount** dans `server.js`.

## Frontend
- `lib/api.js` : `youtubeApi` (search/video/related/categories/favorites/history/share) + `walletAdminApi.getYoutube/updateYoutube`.
- `components/youtube/` : `YoutubeCard`, `YoutubePlayerModal` (iframe embed officiel + gestion **non intégrable** +
  favori/partager + vidéos similaires), `YoutubeSkeleton`.
- `UserVideosPage` : onglets **YouTube** / **KATD** ; recherche (debounce ~500 ms + bouton), catégories,
  filtres (ordre/durée), grille responsive 1→4 col, « Charger plus » (`nextPageToken`), skeleton/vide/erreur/quota,
  sous‑onglets **Favoris** / **Historique**.
- `SocialTab` : posts `type:'youtube'` lus en **lecteur intégré** ; likes/commentaires/partages KATD indépendants.
- `AdminPlatformPage` : `YoutubeKeyPanel` dans l'onglet **Clés API** (sous Ikeepay).

## Variables d'environnement
- `YOUTUBE_API_KEY` (repli si la clé n'est pas mise via l'admin), `YOUTUBE_CACHE_TTL` (optionnel),
  `ENCRYPTION_KEY` (déjà utilisé par Ikeepay, requis pour chiffrer la clé en base).
- `server/.env.example` mis à jour. Ne jamais committer le vrai `.env`.

## Configuration YouTube Data API
1. Google Cloud Console → projet → activer **YouTube Data API v3**.
2. Créer une **clé API** (usage serveur, restreinte à cette API recommandé).
3. La coller dans **Dashboard → Gestion Plateforme → Clés API → YouTube** (ou `YOUTUBE_API_KEY`).
4. Quota : 10 000 u/j ; `search.list`=100 u, `videos.list`=1 u → cache + debounce pour économiser.

## Endpoints créés
`/api/youtube/search`, `/videos/:id`, `/related/:id`, `/categories`, `/favorites` (GET/POST),
`/favorites/:videoId` (DELETE), `/history` (GET/POST/DELETE), `/share` (POST) ;
admin `/api/admin/youtube` (GET/PUT).

## Vérification
Backend charge ; `/api/youtube/categories` OK ; clé collée dans l'admin → recherche réelle ; lecture intégrée
(sans redirection) ; vidéo non intégrable → message ; favoris/historique ; partage → post youtube dans le fil ;
onglet KATD inchangé ; **aucune clé** dans le bundle/réseau du navigateur.
