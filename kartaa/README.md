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
| Création de compte et connexion | Supabase Auth — e-mail + mot de passe, ou Google |
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
| Réseaux et liens | **plusieurs comptes par plateforme**, nommés, réordonnables |
| Scanner de QR Codes | universel, au centre de la barre de navigation |
| Offre unique Pro — 5 000 FCFA / mois | limites **appliquées en base**, pas seulement dans l'interface |
| Langues français / anglais | détection navigateur + choix manuel ; le prix reste en FCFA |
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
coordonnées du projet Supabase de production comme valeurs par défaut.

Une troisième variable, `VITE_PUBLIC_ORIGIN`, fixe l'adresse inscrite dans les
QR Codes. Elle vaut par défaut le domaine de production. **Ne la laissez pas
suivre l'adresse du navigateur** : un QR Code est imprimé et partagé, il doit
pointer vers une adresse stable — sinon un code fabriqué depuis une
préproduction y reste coincé, et la session de l'utilisateur, liée à un seul
domaine, ne suit pas. Pour
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
3. **Connexion avec Google** : activez le fournisseur *Google* dans
   *Sign In / Providers*, puis ajoutez `https://<votre-domaine>/auth/callback`
   dans **Redirect URLs**. Sans cette entrée, Google renvoie vers l'adresse par
   défaut du projet et la session ne s'ouvre pas.

---

## Modèle de sécurité

Les règles vivent dans la base, pas dans le client : un navigateur modifié ne peut
donc pas les contourner. Tout est dans `supabase/migrations/`.

### Réseaux et liens : autant de comptes que voulu

Une carte peut porter trois TikTok, cinq chaînes YouTube et quatre sites web. Les
liens vivent dans leur propre table `social_links` — plateforme, nom, adresse,
ordre d'affichage, actif ou non — et non plus dans un champ par réseau.

L'enregistrement passe par `set_card_social_links()`, qui remplace la liste
complète **en une seule transaction** : une coupure de réseau ne peut pas laisser
la moitié des liens enregistrés. Les lignes vides sont écartées, ce qui permet au
formulaire d'afficher un premier champ par plateforme sans obliger à le remplir.

Sur la carte, une icône par plateforme, sans doublon. Sur le mini-site, les liens
sont groupés par plateforme avec le nom donné par l'utilisateur — « Compte
personnel », « Ma boutique » — chacun cliquable.

### Une adresse de référence pour les QR Codes

Les liens des QR Codes ne sont pas construits avec l'adresse du navigateur mais
avec `APP.publicOrigin`. À la lecture, le scanner reconnaît une adresse Kartaa
sur **n'importe quel domaine de déploiement** et l'ouvre sur le domaine courant,
là où la session existe. Sans cela, un coffre créé sur une préproduction renvoyait
vers cette préproduction, où l'utilisateur n'est pas connecté : l'écran demandait
de se connecter au lieu du mot de passe du coffre.

### Le scanner

Le bouton central de la barre de navigation ouvre un scanner qui lit **n'importe
quel** QR Code, pas seulement ceux de Kartaa. Deux moteurs : `BarcodeDetector`
quand le navigateur l'a (Chrome sur Android), sinon `jsQR` chargé à la demande —
ce qui couvre Safari sans alourdir le reste de l'application.

Le contenu lu décide de la suite : une carte Kartaa ouvre son mini-site sans
quitter l'application, un coffre ouvre son écran de déverrouillage, un site
extérieur est proposé à l'ouverture, un numéro devient appelable, et tout autre
texte reste copiable. Si la caméra est refusée ou absente, on peut ouvrir une
photo du QR Code. Les derniers scans sont conservés sur l'appareil.

La création de carte et de coffre, qui occupait ce bouton central, a été
déplacée dans l'en-tête mobile — elle reste accessible partout ailleurs depuis
le tableau de bord et les listes.

### Une seule offre payante

Gratuit, puis **Pro à 5 000 FCFA par mois**. Pas de second abonnement, pas de
second parcours d'achat : tous les chemins mènent à `/app/abonnement`, et les
fonctionnalités verrouillées affichent le même message avec un unique bouton
« Voir Pro ».

Toute l'application fonctionne en **francs CFA** : `currency = XOF`,
`display = FCFA`, `monthly_price = 5000` dans `src/config/app.config.js`. Aucune
conversion, aucun taux de change, aucune détection de devise par pays — même en
anglais, le prix reste `5,000 FCFA / month`. La structure permet d'ajouter
d'autres devises plus tard sans rien réécrire ailleurs.

### Langues

Français et anglais, détectés d'après le navigateur puis modifiables depuis le
profil ou la page d'abonnement (`src/i18n/`). Cette version traduit le parcours
d'abonnement et le verrou Pro ; **le reste de l'interface est en français** et se
traduira en complétant les mêmes dictionnaires. La langue est indépendante de la
devise.

### Deux façons d'ouvrir un compte

E-mail et mot de passe, ou Google. Les fournisseurs ne nomment pas les champs de
la même façon — notre formulaire envoie `first_name`, Google envoie `given_name`
et `full_name` — donc le déclencheur `handle_new_user()` normalise les deux avant
de créer le profil, photo comprise. Un compte Google n'a pas de numéro de
téléphone : il reste à renseigner dans l'assistant de carte, où il est requis.

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

### Deux authentifications qu'il ne faut pas confondre

| | Ce qu'elle protège | Comment on la franchit |
| --- | --- | --- |
| **Compte** | La gestion des cartes, des coffres, des réglages | E-mail ou Google |
| **Mot de passe du coffre** | Le contenu d'un coffre | Le mot de passe, ou le code de récupération |

Scanner le QR Code d'un coffre mène à son écran de déverrouillage **sans
demander de compte**. C'est le mot de passe du coffre, et lui seul, qui ouvre le
contenu : obliger le visiteur à créer un compte rendrait le QR Code inutile.

Ce que le QR Code transporte : un identifiant, rien d'autre. Ni fichier, ni mot
de passe, ni clé.

Ce qu'un visiteur obtient **avant** le mot de passe : les sels de dérivation,
publics par nature, le nombre de tentatives restantes et l'état du verrou. Pas
le nom du coffre, pas le nombre de fichiers, pas la clé chiffrée.

Ce qu'il obtient **après** : un jeton de session de 256 bits, valable trente
minutes, dont le serveur ne garde que l'empreinte. Ce jeton donne la liste des
fichiers puis, un par un, des URL signées d'une minute — produites par la
fonction Edge `vault-file`, qui revérifie le jeton avant de signer quoi que ce
soit. Le bucket `vault-files` reste privé de bout en bout, et les fichiers
restent chiffrés jusque dans le navigateur.

Le propriétaire connecté garde son chemin d'origine : les règles d'accès le
reconnaissent, il signe ses URL lui-même.

### Ce que « mot de passe oublié » fait depuis un QR Code

Le code de récupération tient lieu de preuve, exactement comme le mot de passe :
il permet de choisir un nouveau mot de passe et d'ouvrir le coffre dans la
foulée, sans compte. Un nouveau code de récupération est émis au passage,
l'ancien cesse de valoir.

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
| `social_links` | réseaux et liens, plusieurs par plateforme | son propriétaire ; le public via `card_by_slug()` |
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

## Application installable (PWA)

Kartaa s'installe depuis le navigateur, sans passer par un magasin
d'applications : manifeste à la portée `/`, icônes 192/512 et une icône
masquable pour Android, mode autonome, raccourcis vers le scanner, les coffres
et les cartes.

Le service worker suit deux règles, dans cet ordre :

1. **Rien de ce qui vient d'ailleurs n'est mis en cache.** Appels à Supabase,
   URL signées des fichiers de coffre, jetons d'authentification : un fichier
   déchiffré oublié dans un cache annulerait la protection du coffre. Seules les
   requêtes GET de ce domaine sont interceptées.
2. Les pages passent par le réseau d'abord, le cache seulement s'il ne répond
   pas ; les fichiers versionnés de `/assets/` passent par le cache d'abord,
   leur nom changeant à chaque version.

Une nouvelle version **ne prend jamais la main toute seule** : un bandeau la
propose, et le rechargement n'a lieu qu'après le clic.

### L'installation doit être possible au premier chargement

Trois choses l'en empêchaient, et la première était la plus sournoise :

1. **Le service worker était enregistré dans un écouteur de `load`.** Quand la
   page se charge vite, `load` est déjà émis au moment où le module s'exécute :
   l'écouteur n'était jamais appelé, aucun service worker n'était enregistré, et
   Chrome n'avait donc aucune raison d'émettre `beforeinstallprompt`. Recharger
   la page réglait le problème par hasard. On regarde désormais
   `document.readyState` au lieu d'attendre un évènement peut-être déjà passé.
2. **Le bandeau attendait la deuxième visite**, et c'était le seul endroit d'où
   installer. Le délai ne s'applique plus qu'au bandeau, et un bouton permanent
   existe sur la page publique comme dans le profil.
3. **Rien n'était prévu pour les navigateurs sans installation programmable.**
   Safari sur iPhone et Firefox n'émettent jamais `beforeinstallprompt` : ils
   reçoivent maintenant la marche à suivre par le menu, jamais une consigne de
   rechargement.

Une fois installée, l'application dit qu'elle l'est et ne propose plus rien. Et
`/` n'y affiche jamais la page vitrine : connecté, on arrive au tableau de bord ;
sinon, à la connexion.

`npm run test:pwa` vérifie tout cela dans un navigateur, à commencer par
l'absence de toute ressource externe dans les caches.

## Gratuit et Pro

Un seul produit payant : **Pro, 5 000 FCFA par mois**. Premium et VIP sont des
styles de cartes, pas des offres ; le coffre, le scanner, le NFC et le domaine
n'ont pas d'abonnement à eux.

| Gratuit | Pro |
| --- | --- |
| 1 carte, modèle Standard | Plusieurs cartes, modèles Premium et VIP |
| Mini-site public complet : coordonnées, WhatsApp, e-mail, réseaux, services | Galerie, plusieurs entreprises, plusieurs activités, personnalisation avancée |
| Réseaux et liens illimités | Domaine personnalisé, QR personnalisé |
| Scanner universel et historique | Statistiques avancées |
| 1 coffre, 200 Mo | Plusieurs coffres, 20 Go |
| Application installable, français et anglais | — |

### La séparation est tenue par la base, pas par l'écran

Cacher un bouton ne protège rien. Trois choses ne tenaient qu'à l'interface, et
tiennent désormais côté serveur :

1. **La colonne `plan`.** La politique RLS autorise un compte à modifier sa
   ligne de profil — plan compris : une commande depuis la console du navigateur
   suffisait à devenir Pro. Un déclencheur ramène maintenant toute écriture du
   plan à sa valeur précédente, sauf appel à `set_user_plan()`, fermée à `anon`
   comme à `authenticated`. Ce déclencheur est en `SECURITY INVOKER` : dans une
   fonction `SECURITY DEFINER`, `current_user` vaut le propriétaire et ne permet
   jamais de reconnaître un appel venu du navigateur.
2. **Les options Pro d'une carte** — modèles Premium et VIP, domaine, galerie,
   entreprises et activités multiples — sont refusées par un déclencheur sur
   `cards`. Il ne bloque que ce qui *augmente* : un compte qui repasse en gratuit
   garde ses données et peut toujours les corriger.
3. **Les statistiques avancées** répondent `{"locked":"pro"}` au lieu de
   chiffres.

Le nombre de cartes, de coffres et le quota de stockage étaient déjà tenus par
`plan_limits()` et ses déclencheurs ; rien n'y a changé.

### Aucun paiement n'est simulé

La page d'abonnement écrivait directement `plan = 'pro'` : un paiement réussi
qui n'avait jamais eu lieu. Le bouton enregistre désormais une intention dans
`subscription_requests` et le dit clairement. L'activation passe par
`set_user_plan()`, côté serveur — c'est là que se branchera l'encaissement.

`npm run test:plan` compare les deux offres dans un navigateur : un seul bouton,
un seul prix, aucune activation sans paiement, et un verrou qui nomme la
fonctionnalité au lieu d'un cadenas muet.

## Ce qu'une carte déclenche

Les scans étaient comptés, mais pas ce qui suit le scan. La table `card_events`
enregistre désormais les ouvertures de mini-site, les appels, les messages
WhatsApp, les e-mails, les clics sur les réseaux et les ajouts aux contacts.

Ce qui est enregistré : le type d'action, et la plateforme pour un réseau
social. Jamais qui a cliqué — un mini-site public n'a ni compte, ni
identifiant, ni adresse à rattacher à son visiteur. Le détail s'affiche dans
Statistiques, sous la même règle que le reste des statistiques avancées :
réservé à l'abonnement Pro existant, sans nouvelle offre ni nouveau prix.

## Préparé, pas encore branché

| | État |
| --- | --- |
| **Carte NFC** | Table `card_media` : un support physique est relié à une carte. Une puce n'est qu'un déclencheur de plus vers le même mini-site ; l'activer demandera d'écrire l'adresse publique sur la puce et d'enregistrer son numéro de série. Aucun parcours ne s'en sert encore. |
| **Impression** | Table `card_orders` : le formulaire de commande enregistre réellement la demande, sans paiement. L'abonnement Pro reste le seul. |
| **Notifications** | `src/lib/notifications.js` et un réglage dans le profil. Rien n'est envoyé : l'autorisation n'est demandée que sur un geste explicite, car un refus est définitif pour le navigateur. |

## Routes

| Route | Rôle |
| --- | --- |
| `/` | Page d'accueil publique |
| `/inscription`, `/connexion` | Compte |
| `/app` | Tableau de bord |
| `/app/cartes`, `/app/cartes/nouvelle`, `/app/cartes/:id` | Cartes |
| `/app/coffres`, `/app/coffres/nouveau`, `/app/coffres/:id` | Coffres |
| `/app/scanner` | Scanner de QR Codes |
| `/app/statistiques`, `/app/profil` | Statistiques et profil |
| `/app/abonnement` | **Page unique d'abonnement** — tous les chemins y mènent |
| `/coffre/:vaultId` | **Cible du QR Code d'un coffre** — déverrouillage, sans compte |
| `/vault/:vaultId`, `/c/:vaultId` | Mêmes écrans — alias, et adresse des QR Codes déjà imprimés |
| `/diagnostic` | Diagnostic de la persistance de session sur l'appareil |
| `/:slug` | **Cible du QR Code d'une carte** — mini-site public |

---

## Build et déploiement

```bash
npm run build     # génère dist/
npm run preview   # sert dist/ en local
```

`vercel.json` fixe le framework (Vite), la sortie `dist` et la réécriture SPA —
toutes les routes renvoient vers `index.html`, ce qui est indispensable pour
`/:slug` et `/c/:id`.

Le dépôt est lié au projet Vercel **kartaa**, avec `kartaa` comme *Root Directory* :
chaque push redéploie automatiquement. La branche de production est `main` ; tant
que Kartaa vit sur une branche de travail, ce sont des déploiements de
prévisualisation qui sont produits.

Le projet est servi en accès libre, comme n'importe quel site vitrine : c'est
nécessaire pour qu'un QR Code scanné depuis un téléphone ouvre le mini-site plutôt
qu'un écran de connexion à l'hébergeur. Les zones privées de l'application — le
tableau de bord et les coffres — restent protégées par l'authentification décrite
plus haut.

### Vérification du téléchargement des deux faces

```bash
npm run build && npm run preview -- --port 4173
npm run test:export
```

Le test intercepte le clic de téléchargement pour récupérer le fichier
réellement produit, puis vérifie que le verso n'est ni vide, ni une copie du
recto. Regarder l'écran ne suffisait pas : le recto s'affichait correctement,
c'est le fichier qui était faux — l'export rendait `front` quelle que soit la
face demandée.

### Vérification de la session et de la navigation (navigateur réel)

```bash
npm run build && npm run preview -- --port 4173
npm run test:session
```

Le serveur d'authentification est volontairement coupé pendant le test. Sont
vérifiés : l'actualisation d'une page, le retour sur le site, la navigation puis
actualisation, la déconnexion volontaire, le repli sur les cookies quand le
stockage local est refusé, et le fait que la page d'un coffre ne réclame jamais
de compte.

### Vérification du chiffrement (hors ligne)

```bash
npm run test:crypto
```

Seize contrôles sur `src/lib/crypto.js`, sans réseau ni navigateur : un mauvais
mot de passe ne déchiffre rien, le vérificateur détenu par le serveur ne permet
pas d'ouvrir le coffre, un chiffré modifié est rejeté, le code de récupération
ouvre le même coffre, et une réinitialisation laisse les fichiers déjà chiffrés
lisibles. C'est le test à relancer après toute modification du chiffrement.

### Vérification du scanner (hors ligne)

```bash
npm run test:scanner
```

Génère de vrais QR Codes, les relit avec le moteur du navigateur et vérifie
l'aiguillage : carte, coffre, page interne, site extérieur, numéro, texte libre
et fiche contact.

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

- **Paiement** : l'abonnement s'active aujourd'hui en mode démonstration depuis
  `/app/abonnement`. Brancher un prestataire compatible FCFA (Wave, Orange Money,
  MTN MoMo, Stripe…) revient à écrire la colonne `profiles.plan` depuis un webhook
  serveur — les limites sont déjà appliquées en base, elles suivront
  automatiquement. Le montant à transmettre est **5 000 FCFA par mois**.
- **Impression physique** : le formulaire enregistre la demande ; il reste à la
  transmettre à un imprimeur.
- **Domaine personnalisé** : l'interface enregistre le domaine et affiche les
  instructions DNS. La vérification demande une intégration côté hébergeur.
