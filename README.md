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

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | URL du projet Supabase (ex. `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Clé publique `anon` du projet Supabase |

Ces deux variables doivent être définies dans Vercel (Settings → Environment
Variables) pour les environnements *Production*, *Preview* et *Development*.

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
