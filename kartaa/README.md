# Kartaa — carte de visite numérique, mini-site et Coffre Sécurité

> **Votre identité. Votre carte. Votre QR Code.**
>
> Créez votre carte de visite numérique, partagez toutes vos coordonnées en un seul
> scan et protégez vos souvenirs et documents dans un Coffre Sécurité.

Application React adossée à un backend **Supabase** : comptes, base de données,
stockage de fichiers et règles d'accès côté serveur.

> **Nom provisoire.** « Kartaa » se change en une ligne dans
> `src/config/app.config.js` (constante `APP.name`).

---

## Ce que l'application fait

| Parcours | État |
| --- | --- |
| Création de compte et connexion | Supabase Auth |
| Assistant de création de carte en 5 étapes | fonctionnel |
| Prévisualisation en direct, 3 modèles, couleurs et typographie | fonctionnel |
| Génération du QR Code | fonctionnel (le QR pointe vers le mini-site, jamais vers un numéro) |
| Page publique / mini-site | fonctionnel, avec « Ajouter aux contacts » (.vcf) |
| Téléchargement de la carte en PNG / JPG / PDF | fonctionnel (PDF recto + verso) |
| Coffre Sécurité : création, fichiers, dossiers | fonctionnel, **chiffré AES-256-GCM avant téléversement** |
| Protection par mot de passe | fonctionnel, **tentatives comptées côté serveur** |
| Déverrouillage biométrique | WebAuthn quand l'appareil le propose |
| Code de récupération + réinitialisation | fonctionnel, code renouvelé après usage |
| QR Code du coffre → écran de déverrouillage | fonctionnel |
| Statistiques (scans, stockage, classement) | fonctionnel |
| Offres Gratuit / Premium / VIP | limites **appliquées en base**, pas seulement dans l'interface |
| Quotas de stockage | appliqués par déclencheur ; le plan Supabase lui-même plafonne l'espace total du projet (1 Go sur l'offre gratuite) |
| Nom de domaine personnalisé | **interface + instructions DNS uniquement** — aucun registrar branché |
| Commande de cartes physiques | **formulaire de demande uniquement** |
| Paiement en ligne | **non branché** — l'offre se change en mode démonstration |

---

## Démarrage

```bash
cd kartaa
npm install
npm run dev      # http://localhost:5174
```

Aucune configuration n'est nécessaire : `src/lib/supabaseClient.js` contient les
coordonnées du projet Supabase de production comme valeurs par défaut. Pour
brancher un autre projet, copiez `.env.example` vers `.env` et renseignez
`VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`.

La clé « publishable » est publique par conception — elle part dans le navigateur
de chaque visiteur. Ce qui protège les données, ce sont les règles décrites plus
bas, pas le secret de cette clé.

### À régler une fois dans le tableau de bord Supabase

1. **Authentication → URL Configuration** : ajoutez l'URL de votre déploiement
   (`https://…vercel.app`) dans *Site URL* et *Redirect URLs*, sinon les liens de
   confirmation et de réinitialisation ne fonctionneront pas.
2. **Authentication → Sign In / Providers → Email** : si *Confirm email* est
   activé, chaque inscription attend un clic dans l'e-mail reçu. L'application
   gère les deux cas ; pour des tests plus rapides, désactivez l'option.

---

## Modèle de sécurité

Les règles vivent dans la base, pas dans le client : un navigateur modifié ne peut
donc pas les contourner. Tout est dans `supabase/migrations/`.

### Les cartes sont publiques, l'annuaire ne l'est pas

Une carte de visite est faite pour être lue par tout le monde — mais pas pour
qu'on aspire les coordonnées de tous les utilisateurs. La table `cards` n'est donc
lisible que par son propriétaire ; les visiteurs passent par `card_by_slug()`, qui
renvoie **une** carte, par son adresse, sans l'identifiant du compte. Sans
connaître l'adresse, on n'obtient rien.

### Le serveur ne peut pas ouvrir vos coffres

Une seule dérivation PBKDF2-SHA256 (210 000 itérations) produit 512 bits :

- les **256 premiers bits** forment la clé qui chiffre la clé du coffre. Ils ne
  quittent jamais le navigateur ;
- les **256 suivants** forment un « vérificateur » envoyé au serveur, qui n'en
  conserve que l'empreinte SHA-256.

Le serveur peut donc vérifier que vous connaissez le mot de passe sans jamais
pouvoir déchiffrer quoi que ce soit. Et comme il détient la clé chiffrée, il peut
refuser de la livrer : c'est ce qui rend la limitation des tentatives réelle.

1. La clé de chaque coffre est **aléatoire**, chiffrée deux fois séparément : par
   le mot de passe, et par le code de récupération.
2. La table `vault_secrets` a RLS activé **sans aucune politique** : personne, pas
   même le propriétaire, ne la lit directement. Seules les fonctions `vault_*`
   y accèdent.
3. **Limitation des tentatives** : 5 essais, puis blocage progressif
   (30 s → 60 s → 5 min → 15 min). Les fonctions d'ouverture renvoient un *statut*
   au lieu de lever une exception — une exception annulerait la transaction, donc
   aussi l'incrément du compteur, et la limitation ne servirait à rien.
4. Chaque fichier est chiffré **avant** téléversement, avec son propre vecteur
   d'initialisation. Le bucket `vault-files` est privé et les fichiers sont servis
   par **URL signée valable 60 secondes**.
5. Après authentification, la clé vit **uniquement en mémoire**
   (`src/lib/vaultSession.js`) : rechargement, déconnexion ou 15 minutes
   d'inactivité la font disparaître.
6. **Journal des accès** : créations, déverrouillages réussis ou non,
   consultations, ajouts et suppressions.
7. Le **QR Code d'un coffre ne contient aucun document** : seulement l'identifiant
   du coffre, qui mène à l'écran d'authentification.
8. Le **code de récupération est à usage unique** : après réinitialisation, un
   nouveau code est généré et l'ancien cesse de fonctionner.

**Conséquence à assumer :** si vous perdez à la fois le mot de passe et le code de
récupération, les fichiers sont définitivement illisibles. Personne — ni vous, ni
Supabase, ni nous — ne peut les récupérer. C'est le prix du chiffrement de bout en
bout, et c'est volontaire.

### Un coffre n'est pas un lien de partage

Scanner le QR Code d'un coffre mène à son écran de déverrouillage, mais il faut
**être connecté au compte propriétaire** avant de pouvoir saisir le mot de passe.
Un coffre est un espace personnel : le partage avec des tiers n'est pas
implémenté, et les règles d'accès le refusent.

### Biométrie

Aucune empreinte n'entre dans l'application : le capteur reste géré par le système
d'exploitation, qui ne renvoie qu'une signature (WebAuthn). Deux niveaux selon
l'appareil (`src/lib/webauthn.js`) :

- **extension PRF** — le secret qui déchiffre la clé est *dérivé* de
  l'authentification biométrique ; rien d'exploitable n'est conservé ;
- **repli** — la clé est enveloppée par un secret aléatoire lié à l'appareil,
  conservé localement, dont l'usage est conditionné à une assertion biométrique.

Dans les deux cas, **le mot de passe reste le secret de référence** : c'est lui qui
ouvre le coffre depuis n'importe quel appareil.

---

## Architecture

```
src/
  config/app.config.js       Nom du produit, offres, limites, réseaux, modèles
  lib/
    supabaseClient.js        Connexion et traduction des erreurs
    crypto.js                PBKDF2, AES-GCM, vérificateurs, codes de récupération
    vaultService.js          Métier du coffre : création, ouverture, fichiers
    vaultSession.js          Clés déverrouillées — mémoire uniquement
    webauthn.js              Biométrie (WebAuthn + PRF)
    storage/
      index.js               Point d'entrée unique des données
      supabase.adapter.js    Toutes les requêtes de l'application
      assets.js              Images publiques des cartes
    qr.js, cardExport.js, vcard.js, download.js, format.js, slug.js
  state/                     AuthContext, DataContext, ToastContext
  components/
    ui/                      Bibliothèque d'interface + icônes vectorielles
    card/CardArtwork.jsx     Rendu des cartes (écran et export, à l'identique)
  features/
    landing/ auth/ dashboard/ cards/ vault/ public/ stats/ profile/
  router/AppLayout.jsx       Barre latérale, navigation mobile, bouton « + Créer »

supabase/migrations/         Schéma, règles d'accès et fonctions — la référence
```

Aucun composant n'appelle Supabase directement : tout passe par `repo`
(`src/lib/storage/index.js`) et par `vaultService`. Les tables et fonctions sont
documentées dans le schéma.

### Tables

| Table | Rôle | Qui peut lire |
| --- | --- | --- |
| `profiles` | compte, offre | son propriétaire |
| `cards` | cartes et mini-sites | son propriétaire ; le public via `card_by_slug()` |
| `card_scans` | journal des scans | le propriétaire de la carte |
| `vaults` | coffres (métadonnées) | son propriétaire |
| `vault_secrets` | clés chiffrées, vérificateurs | **personne** — fonctions `vault_*` uniquement |
| `vault_files` | fichiers chiffrés (métadonnées) | le propriétaire du coffre |
| `vault_access_log` | journal des accès | le propriétaire du coffre |

### Espaces de fichiers

| Bucket | Accès | Contenu |
| --- | --- | --- |
| `card-assets` | lecture publique, écriture par le propriétaire | photos et logos du mini-site |
| `vault-files` | privé, URL signées de 60 s | fichiers **chiffrés** des coffres |

---

## Routes

| Route | Rôle |
| --- | --- |
| `/` | Page d'accueil publique |
| `/inscription`, `/connexion` | Compte |
| `/app` | Tableau de bord |
| `/app/cartes`, `/app/cartes/nouvelle`, `/app/cartes/:id` | Cartes |
| `/app/coffres`, `/app/coffres/nouveau`, `/app/coffres/:id` | Coffres |
| `/app/statistiques`, `/app/profil` | Statistiques et profil |
| `/c/:vaultId` | **Cible du QR Code d'un coffre** — déverrouillage |
| `/:slug` | **Cible du QR Code d'une carte** — mini-site public |

---

## Build et déploiement

```bash
npm run build     # génère dist/
npm run preview   # sert dist/ en local
```

`vercel.json` est prêt : framework Vite, sortie `dist`, réécriture SPA (toutes les
routes renvoient vers `index.html`, indispensable pour `/:slug` et `/c/:id`).
Sur Vercel, importez le dépôt et réglez **Root Directory** sur `kartaa`.

### Vérification du chiffrement (hors ligne)

```bash
npm run test:crypto
```

Seize contrôles sur `src/lib/crypto.js`, sans réseau ni navigateur : un mauvais
mot de passe ne déchiffre rien, le vérificateur détenu par le serveur ne permet
pas d'ouvrir le coffre, un chiffré modifié est rejeté, le code de récupération
ouvre le même coffre, et une réinitialisation laisse les fichiers déjà chiffrés
lisibles. C'est le test à relancer après toute modification du chiffrement.

### Test de bout en bout

`scripts/e2e-smoke.mjs` rejoue tout le parcours dans un vrai navigateur — compte,
carte, QR Code, mini-site, téléchargement PNG/PDF, coffre, fichier chiffré,
verrouillage, mauvais mot de passe, récupération.

```bash
npm install --no-save playwright && npx playwright install chromium
npm run build
npm run preview -- --port 4178 &
npm run test:e2e            # captures d'écran dans .e2e-output/
```

Il lui faut un accès réseau au projet Supabase, et *Confirm email* désactivé dans
les réglages d'authentification (sinon l'inscription s'arrête sur l'écran de
confirmation, ce que le test signale clairement).

---

## Ce qui reste à brancher

`FEATURE_FLAGS` dans `src/config/app.config.js` décrit l'état de chaque extension.

- **Paiement** : l'offre se change aujourd'hui en mode démonstration depuis le
  profil. Brancher un prestataire (Stripe, Wave, Orange Money…) revient à écrire
  la colonne `profiles.plan` depuis un webhook serveur — les limites sont déjà
  appliquées en base, elles suivront automatiquement.
- **Impression physique** : le formulaire enregistre la demande ; il reste à la
  transmettre à un imprimeur.
- **Domaine personnalisé** : l'interface enregistre le domaine et affiche les
  instructions DNS. La vérification demande une intégration côté hébergeur.
