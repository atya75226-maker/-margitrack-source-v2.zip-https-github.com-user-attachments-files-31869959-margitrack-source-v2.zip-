# Margitrack

Application de gestion pour restaurants et petits commerces : ventes, produits,
stock, dépenses, abonnements et tableau de bord de marge.

## Stack technique

- **React 18** + **Vite 5** (build statique dans `dist/`)
- **Tailwind CSS** pour l'interface
- **Supabase** pour l'authentification, la base de données et les Edge Functions
- **Recharts** pour les graphiques du tableau de bord

## Démarrage en local

```bash
npm install
cp .env.example .env   # puis renseignez vos clés Supabase
npm run dev
```

L'application est disponible sur http://localhost:5173.

## Variables d'environnement

Aucune configuration n'est nécessaire pour déployer : `src/lib/supabaseClient.js`
contient les coordonnées du projet Supabase de production comme valeurs par
défaut. Le projet se construit et se déploie tel quel.

Ces valeurs peuvent être remplacées, sans modifier le code, par deux variables
d'environnement optionnelles — utile pour brancher l'application sur un autre
projet Supabase (un environnement de test, par exemple) :

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | URL du projet Supabase (Project Settings → API → Project URL) |
| `VITE_SUPABASE_ANON_KEY` | Clé publique `anon` (Project Settings → API → anon public) |

En local, copiez `.env.example` vers `.env`. Sur Vercel, Settings → Environment
Variables. Vite remplace ces valeurs au moment du build : après toute
modification, relancez un déploiement.

La clé `anon` est publique par conception — elle part dans le navigateur de
chaque visiteur. Ce qui protège les données, ce sont les politiques Row Level
Security définies dans Supabase, pas le secret de cette clé.

## Build de production

```bash
npm run build     # génère dist/
npm run preview   # sert dist/ en local pour vérification
```

## Déploiement sur Vercel

Le dépôt est prêt à être déployé tel quel : `vercel.json` fixe le framework
(Vite), la commande de build, le dossier de sortie `dist`, la réécriture SPA
(toutes les routes renvoient vers `index.html`) et le cache long des assets.

1. Sur Vercel, importez ce dépôt GitHub (*Add New… → Project*).
2. Laissez les réglages détectés automatiquement — ils proviennent de `vercel.json`.
3. Ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans les variables d'environnement.
4. Déployez. Chaque push sur la branche par défaut redéploie la production.

### Après le déploiement

Dans Supabase → *Authentication* → *URL Configuration*, ajoutez l'URL Vercel
(`https://<votre-projet>.vercel.app`) dans **Site URL** et **Redirect URLs**,
sinon les liens de connexion et de réinitialisation de mot de passe échoueront.

## Intégration continue

`.github/workflows/ci.yml` installe les dépendances et exécute `npm run build`
à chaque push et chaque pull request, pour détecter une erreur de build avant
le déploiement.

## Page de menu « Le Baobab » (démonstration)

`public/baobab/index.html` est une carte numérique autonome pour un restaurant
fictif : un seul fichier HTML, sans build, sans compte, sans paiement et sans
dépendance à l'application Margitrack.

- **URL après déploiement** : `https://<votre-domaine>/baobab/`
  (c'est cette adresse HTTPS que l'on encode dans un tag NFC ou un QR code).
- **Photos** : les 31 emplacements sont remplis, aucun vide. Les images
  viennent de Pexels (licence commerciale libre) et de Wikimedia Commons, avec
  une URL de secours par plat et un repli propre si les deux échouent.
- **Vérifier les images** : `node scripts/verifier-photos.mjs` teste les 31 URL
  et dit plat par plat ce qu'un téléphone verra.
- **Rapatrier les images** : `node scripts/baobab-photos.mjs` télécharge tout
  dans `public/baobab/photos/` et bascule la page sur les fichiers locaux.
- **Modifier la carte** : plats et prix sont en clair dans le HTML, section par
  section. Les prix sont en francs CFA ; pour changer de devise, remplacez les
  `<small>FCFA</small>` et la mention du pied de page.
- **Coordonnées** : adresse, horaires et numéro de téléphone (`tel:`) se
  trouvent dans l'en-tête et le pied de page du fichier.

Aucune donnée n'est collectée et aucun compte n'est nécessaire. Les seuls
appels réseau sont les deux polices Google Fonts (repli système si elles sont
indisponibles) et les photos, tant qu'elles ne sont pas rapatriées en local.
