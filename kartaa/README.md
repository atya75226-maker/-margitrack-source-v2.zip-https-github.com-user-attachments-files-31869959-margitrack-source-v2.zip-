# Kartaa — carte de visite numérique, mini-site et Coffre Sécurité

> **Votre identité. Votre carte. Votre QR Code.**
>
> Créez votre carte de visite numérique, partagez toutes vos coordonnées en un seul
> scan et protégez vos souvenirs et documents dans un Coffre Sécurité.

Prototype fonctionnel et navigable : tout le parcours utilisateur existe et marche
de bout en bout, sans serveur à installer.

> **Nom provisoire.** « Kartaa » se change en une ligne dans
> `src/config/app.config.js` (constante `APP.name`).

---

## Ce que le prototype fait réellement

| Parcours | État |
| --- | --- |
| Création de compte et connexion | fonctionnel (mot de passe haché PBKDF2-SHA256, 210 000 itérations) |
| Assistant de création de carte en 5 étapes | fonctionnel |
| Prévisualisation en direct, 3 modèles, couleurs et typographie | fonctionnel |
| Génération du QR Code | fonctionnel (le QR pointe vers le mini-site, jamais vers un numéro) |
| Page publique / mini-site | fonctionnel, avec « Ajouter aux contacts » (.vcf) |
| Téléchargement de la carte en PNG / JPG / PDF | fonctionnel (PDF recto + verso) |
| Création d'un Coffre Sécurité | fonctionnel |
| Ajout de fichiers (photos, vidéos, documents, dossiers) | fonctionnel, **chiffré AES-256-GCM avant stockage** |
| Protection par mot de passe | fonctionnel |
| Déverrouillage biométrique | fonctionnel via WebAuthn quand l'appareil le propose |
| Code de récupération + réinitialisation du mot de passe | fonctionnel, code renouvelé après usage |
| QR Code du coffre → écran de déverrouillage | fonctionnel |
| Statistiques (scans, stockage, classement) | fonctionnel |
| Offres Gratuit / Premium / VIP et limites associées | fonctionnel (changement d'offre en mode démonstration) |
| Nom de domaine personnalisé | **interface + instructions DNS uniquement** — aucun registrar branché |
| Commande de cartes physiques | **formulaire de demande uniquement** — pas d'impression |
| Paiement en ligne | **non branché** — architecture prête (`FEATURE_FLAGS.payments`) |

---

## Démarrage

```bash
cd kartaa
npm install
npm run dev      # http://localhost:5174
```

```bash
npm run build    # génère dist/
npm run preview  # sert dist/ pour vérification
```

Aucune variable d'environnement n'est nécessaire : le prototype fonctionne
entièrement dans le navigateur.

### Test de bout en bout

`scripts/e2e-smoke.mjs` rejoue tout le parcours dans un vrai navigateur — compte,
carte, QR Code, mini-site, téléchargement PNG/PDF, coffre, fichier chiffré,
verrouillage, mauvais mot de passe, récupération — et vérifie qu'aucun contenu en
clair n'atterrit dans le stockage du navigateur.

```bash
npm install --no-save playwright && npx playwright install chromium
npm run build
npm run preview -- --port 4178 &
npm run test:e2e            # captures d'écran dans .e2e-output/
```

---

## Où vivent les données

Ce prototype n'a volontairement **pas de serveur**, pour qu'on puisse le tester
immédiatement. Les données restent sur l'appareil :

- **localStorage** — comptes, cartes, métadonnées des coffres (jamais les secrets en clair) ;
- **IndexedDB** — les octets : photos, logos et **fichiers des coffres, déjà chiffrés**.

Conséquence à connaître pendant les tests : une carte créée sur un téléphone n'est
pas visible depuis un autre appareil. Brancher un backend lève cette limite sans
toucher à l'interface (voir ci-dessous).

---

## Sécurité du Coffre Sécurité

Le coffre n'est pas une simulation : le chiffrement est réel, effectué par
l'API WebCrypto du navigateur (`src/lib/crypto.js`).

1. Chaque coffre reçoit une **clé AES-256-GCM aléatoire**.
2. Cette clé est chiffrée deux fois, séparément :
   - par une clé dérivée du **mot de passe** (PBKDF2-SHA256, 210 000 itérations, sel aléatoire) ;
   - par une clé dérivée du **code de récupération** (même procédé, sel distinct).
3. Le mot de passe et le code de récupération ne sont **jamais stockés**, sous
   aucune forme : une saisie erronée se traduit par un échec de déchiffrement.
4. Chaque fichier est chiffré **avant** d'être écrit, avec son propre vecteur
   d'initialisation. Aucun octet en clair ne touche le stockage.
5. Après authentification, la clé vit **uniquement en mémoire**
   (`src/lib/vaultSession.js`) : rechargement de page, déconnexion ou 15 minutes
   d'inactivité la font disparaître.
6. Les fichiers consultés passent par des **URL temporaires** (`blob:`) révoquées
   au verrouillage — jamais par une adresse publique et permanente.
7. **Limitation des tentatives** : 5 essais, puis blocage progressif (30 s → 15 min).
8. **Journal des accès** : créations, déverrouillages réussis ou non, consultations,
   ajouts et suppressions de fichiers.
9. Le **QR Code d'un coffre ne contient aucun document** : uniquement l'identifiant
   du coffre, qui mène à l'écran d'authentification.
10. Le **code de récupération est à usage unique** : après une réinitialisation
    réussie, un nouveau code est généré et l'ancien cesse de fonctionner.

### Biométrie

Aucune empreinte n'entre dans l'application : le capteur reste géré par le système
d'exploitation, qui ne renvoie qu'une signature (WebAuthn). Deux niveaux selon
l'appareil (`src/lib/webauthn.js`) :

- **extension PRF** — le secret qui déchiffre la clé du coffre est *dérivé* de
  l'authentification biométrique ; rien d'exploitable n'est conservé ;
- **repli** — la clé est enveloppée par un secret aléatoire lié à l'appareil, dont
  l'usage est conditionné à une assertion biométrique réussie.

Dans les deux cas, **le mot de passe reste le secret de référence** : c'est lui qui
permet d'ouvrir le coffre depuis n'importe quel appareil.

---

## Architecture

```
src/
  config/app.config.js     Nom du produit, offres, limites, réseaux, modèles, drapeaux
  lib/
    crypto.js              PBKDF2, AES-GCM, codes de récupération
    vaultService.js        Métier du coffre : création, déverrouillage, fichiers
    vaultSession.js        Clés déverrouillées — mémoire uniquement
    webauthn.js            Biométrie (WebAuthn + PRF)
    storage/
      index.js             Point d'entrée unique du stockage
      local.adapter.js     Adaptateur « prototype » (localStorage)
      db.js                Stockage binaire (IndexedDB) et URL temporaires
    qr.js, cardExport.js, vcard.js, download.js, format.js, slug.js
  state/                   AuthContext, DataContext, ToastContext
  components/
    ui/                    Bibliothèque d'interface + jeu d'icônes vectorielles
    card/CardArtwork.jsx   Rendu des cartes (écran et export, à l'identique)
  features/
    landing/  auth/  dashboard/  cards/  vault/  public/  stats/  profile/
  router/AppLayout.jsx     Barre latérale, navigation mobile, bouton « + Créer »
```

### Brancher un vrai backend

Toute l'application passe par `repo` (`src/lib/storage/index.js`), dont l'API est
déjà asynchrone et calquée sur celle d'un service distant :

```js
export * as repo from './local.adapter'   // ← remplacer par './supabase.adapter'
```

Écrire un adaptateur exposant `users`, `session`, `cards`, `vaults` suffit :
aucun composant n'a à changer. Côté serveur, il faudra alors respecter les mêmes
règles : fichiers dans un bucket privé, URL signées à durée de vie courte,
politiques d'accès par utilisateur, et chiffrement conservé côté client.

### Ce qui est prévu mais pas branché

`FEATURE_FLAGS` dans `src/config/app.config.js` décrit l'état de chaque extension :
paiement, impression physique, vérification de domaine. Les interfaces existent et
enregistrent la demande de l'utilisateur ; seule la connexion au prestataire manque.

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
| `/c/:vaultId` | **Cible du QR Code d'un coffre** — écran de déverrouillage |
| `/:slug` | **Cible du QR Code d'une carte** — mini-site public |

---

## Déploiement

`vercel.json` est prêt : framework Vite, sortie `dist`, réécriture SPA (toutes les
routes renvoient vers `index.html`, indispensable pour `/:slug` et `/c/:id`).

Sur Vercel, importez le dépôt et réglez **Root Directory** sur `kartaa`.
