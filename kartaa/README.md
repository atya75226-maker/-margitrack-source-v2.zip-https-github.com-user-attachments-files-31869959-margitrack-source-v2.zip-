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
| Prévisualisation en direct, 3 modèles de carte | fonctionnel |
| Couleurs et typographie du mini-site | fonctionnel |
| Génération du QR Code | fonctionnel (le QR pointe vers le mini-site, jamais vers un numéro) |
| Page publique / mini-site | fonctionnel, avec « Ajouter aux contacts » (.vcf) |
| Téléchargement de la carte en PNG / JPG / PDF | fonctionnel (PDF recto + verso), QR Code vectoriel |
| Coffre Sécurité : création, fichiers, dossiers | fonctionnel, **chiffré AES-256-GCM avant téléversement** |
| Protection par mot de passe | fonctionnel, **tentatives comptées côté serveur** |
| Déverrouillage biométrique | WebAuthn quand l'appareil le propose |
| Code de récupération + réinitialisation | fonctionnel, code renouvelé après usage |
| QR Code du coffre → écran de déverrouillage | fonctionnel |
| Statistiques (scans, stockage, classement) | fonctionnel |
| Réseaux et liens | **plusieurs comptes par plateforme**, nommés, réordonnables |
| Scanner de QR Codes | universel, au centre de la barre de navigation |
| Cartes NFC | écriture depuis l'application (Chrome/Android), lecture universelle une fois la puce programmée |
| Offre unique Pro — 5 000 FCFA / mois | limites **appliquées en base**, pas seulement dans l'interface |
| Langues français / anglais | détection navigateur + choix manuel ; le prix reste en FCFA |
| Quotas de stockage | appliqués par déclencheur ; le plan Supabase lui-même plafonne l'espace total du projet (1 Go sur l'offre gratuite) |
| Nom de domaine personnalisé | **interface + instructions DNS uniquement** — aucun registrar branché |
| Commande de cartes physiques | **formulaire de demande uniquement** |
| Paiement en ligne | Chariow : page de paiement + confirmation signée (`chariow-webhook`) |

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

#### Pourquoi un téléphone installe et pas un autre

Le manifeste, les icônes, le `scope` et le HTTPS sont les mêmes pour tout le
monde : ils ne peuvent pas expliquer une différence entre deux appareils. C'est
l'état du navigateur qui change — et surtout, **`beforeinstallprompt` n'est pas
une condition de l'installation, seulement un raccourci.**

Chrome Android ne l'émet qu'après une interaction avec la page, et plusieurs
navigateurs ne l'émettent jamais. Attendre cet évènement pour proposer quoi que
ce soit laissait une impasse à l'écran (« votre navigateur ne l'a pas encore
proposée »), alors que **le menu du navigateur propose toujours l'installation
d'un site éligible**.

Le bouton « Installer Kartaa » mène donc toujours quelque part :

| Navigateur | Ce que fait le bouton |
| --- | --- |
| Chrome, Edge (proposition reçue) | Ouvre la vraie fenêtre d'installation |
| Chrome, Edge (sans proposition) | Menu ⋮ → « Installer l'application » |
| Samsung Internet | Menu ≡ → « Ajouter la page à » → « Écran d'accueil » |
| Firefox | Menu ⋮ → « Installer » |
| Opera | Menu Opera → « Ajouter à… » → « Écran d'accueil » |
| Safari iPhone | Partager → « Sur l'écran d'accueil » |
| Chrome sur iPhone | Seul Safari installe : ouvrir l'adresse dans Safari |
| Fenêtre Facebook / WhatsApp | N'installe jamais : ouvrir dans Chrome |

Deux cas techniques sont détectés et nommés en plus : l'application **déjà
installée** (Chrome cesse alors d'émettre l'évènement) et le **service worker
refusé** par le mode « Lite », l'économiseur de données ou la navigation privée
— sans lui, aucun navigateur ne propose l'installation.

`npm run test:pwa` rejoue les sept navigateurs ci-dessus sur la même adresse et
vérifie que chacun reçoit sa propre marche à suivre, jamais celle d'un autre, et
jamais une consigne de rechargement.

La page `/diagnostic` montre l'état réel sur l'appareil concerné : service
worker enregistré, actif, page contrôlée, proposition reçue, HTTPS, fenêtre
intégrée.

Une fois installée, l'application dit qu'elle l'est et ne propose plus rien. Et
`/` n'y ouvre pas la page vitrine : connecté, on arrive au tableau de bord ;
sinon, à la connexion.

Cette règle vaut pour l'ouverture, pas pour la navigation : une visite demandée
explicitement l'emporte (voir « Se déconnecter » ci-dessous).

`npm run test:pwa` vérifie tout cela dans un navigateur, à commencer par
l'absence de toute ressource externe dans les caches.

## Les cartes NFC

Une puce NFC ne contient qu'une chose : l'adresse du mini-site, la même que le
QR Code. Approcher un téléphone revient exactement à scanner — deux gestes, une
seule destination.

Rien de personnel n'est écrit sur la puce. Ce qui y est inscrit est lisible par
quiconque l'approche, et ne se corrige pas à distance : le numéro et l'e-mail
restent donc sur le mini-site, modifiables, et la puce ne porte que le chemin.

### Ce que le navigateur sait faire, et ce qu'il ne sait pas

Écrire une puce depuis une page web s'appelle **Web NFC**, et seul Chrome sur
Android le propose aujourd'hui. Sur iPhone, aucun navigateur ne peut écrire une
puce : c'est une limite d'iOS.

L'application ne montre donc un bouton d'écriture que là où il fonctionne.
Ailleurs, elle affiche l'adresse exacte à inscrire et explique comment faire
depuis un autre téléphone ou une application NFC — plutôt qu'un bouton qui
échouerait.

**La lecture, elle, ne dépend pas de nous** : une puce programmée s'ouvre sur les
iPhone récents comme sur la plupart des Android, sans rien installer. Une carte
programmée une fois fonctionne partout.

### Où cela se passe

| | |
| --- | --- |
| `src/lib/nfc.js` | détection, écriture, lecture, et les messages d'erreur en clair |
| `src/features/cards/CarteNfc.jsx` | « Ma carte NFC » sur la page d'une carte |
| `src/features/scanner/ScannerPage.jsx` | « Lire une carte NFC », à côté du scanner de QR Codes |
| `card_media` | une ligne par support réellement programmé depuis l'application |

### Vérification

```bash
npm run build && npm run preview -- --port 4173
npm run test:nfc
```

Web NFC n'existe pas dans le navigateur de test : le contrôle installe un faux
lecteur qui note ce qu'on lui demande d'écrire. Ce n'est donc pas l'API du
navigateur qui est vérifiée, mais ce que Kartaa lui donne — une adresse de type
`url`, celle du domaine de référence, et aucune donnée personnelle. Les deux
mondes sont joués : le navigateur qui sait écrire, et celui qui ne sait pas.

## Se déconnecter

Se déconnecter ramène sur la page d'accueil, et non sur un écran de connexion
nu. C'est de là qu'on se reconnecte ou qu'on ouvre un autre compte, et les deux
boutons sont posés en haut de la page, dans un bandeau : personne ne doit avoir
à deviner où aller ensuite.

La page d'accueil reste atteignable partout ailleurs : les écrans de connexion
et d'inscription portent un lien « Retour à l'accueil » écrit en toutes lettres,
et sur téléphone « Se connecter » est visible dans l'en-tête, sans passer par le
menu.

### Le cas de l'application installée

L'application posée sur l'écran d'accueil suit une règle particulière : lancée
depuis son icône sans session, elle ouvre la connexion, pas la vitrine. Cette
règle ne doit pas rendre l'accueil inatteignable pour autant.

Une déconnexion et le bouton « Retour à l'accueil » marquent donc la visite
comme voulue (un état passé au routeur), et l'accueil s'affiche alors, même
installée. Le lancement depuis l'icône, lui, ne porte pas cet état : il continue
d'aller droit à la connexion.

```bash
npm run build && npm run preview -- --port 4173
npm run test:deconnexion
```

Le contrôle joue les deux situations — navigateur ordinaire et application
installée — et vérifie les deux sens : on revient bien à l'accueil, et
l'ouverture depuis l'icône mène toujours à la connexion.

## Le profil public, et la vitrine

Le mini-site public (`/<votre-adresse>`) et la page d'accueil partagent un seul
composant d'affichage : `src/features/public/ProfileView.jsx`.

Ce n'est pas une coquetterie d'architecture. La page d'accueil montre un profil
dans un téléphone ; si c'était une maquette dessinée à côté, elle se mettrait à
mentir au premier changement du vrai profil. Ici, la démonstration EST le
produit — seules les informations affichées sont des exemples, et la page le
dit.

`PublicProfilePage` garde ce qui touche aux données : chargement, mode hors
connexion, comptage des visites, partage, fiche contact. `ProfileView` ne fait
qu'afficher ce qu'on lui donne.

### Rien n'est affiché qui n'existe pas

| Donnée absente | Ce qui s'affiche |
| --- | --- |
| Pas de numéro | pas de bouton « Appeler » |
| Pas d'e-mail | pas de bouton « E-mail » |
| Aucun réseau | pas de section « Mes réseaux » |
| Aucun service, aucune photo | sections absentes, pas de liste vide |
| Pas de photo de profil | les initiales, sur le même fond |

Un profil qui ne renseigne que son nom et son WhatsApp reste une page nette.
C'est vérifié : `npm run test:profil` joue un profil complet *et* un profil
presque vide.

### Les réseaux, en ligne

Les réseaux sont une rangée d'icônes, défilante sur téléphone. Une plateforme
qui ne porte qu'un compte mène directement au lien ; une plateforme qui en porte
plusieurs — c'est permis — déplie la liste, parce qu'une icône ne peut pas mener
à deux endroits. Les sites et autres adresses ont leur propre section, avec leur
libellé en toutes lettres.

### La scène d'accueil est dessinée, pas photographiée

`src/features/landing/SceneBureau.jsx` montre quelqu'un à son bureau, en
costume, sa carte à la main. C'est un dessin vectoriel, pas une photographie :
une photo de banque d'images montrerait un inconnu qui n'a jamais utilisé
Kartaa. Le dessin ne prétend rien, pèse quelques kilo-octets, s'affiche sans
réseau et ne devient jamais flou.

La carte tenue dans la main n'est pas dessinée non plus : c'est `CardArtwork`,
avec un vrai QR Code — celui qui ouvre le site. Ce que la scène montre est donc
exactement ce que l'application produit.

Les mouvements sont lents et discrets : la carte respire, un reflet la balaie,
la plante bouge à peine. Ils s'arrêtent tous sous `prefers-reduced-motion`, et
la scène reste lisible, simplement immobile.

### La vitrine ne promet que ce qui existe

`npm run test:vitrine` relit la page d'accueil comme un visiteur la reçoit et
refuse : le domaine personnalisé et l'impression de cartes — ce que
`FEATURE_FLAGS` annonce comme non branché. Le pied de page, lui, dit franchement
ce qui ne l'est pas encore.

Le bouton « Passer à Pro » mène au vrai parcours (`/app/abonnement`, ou
l'inscription si personne n'est connecté), jamais à une activation directe.

```bash
npm run build && npm run preview -- --port 4173
npm run test:profil     # profil complet, puis profil presque vide
npm run test:vitrine    # aucune promesse qui n'existe pas
```

## La carte : deux faces, rien de plus

La carte ne contient pas l'identité — elle y donne accès.

| | Recto | Verso |
| --- | --- | --- |
| Standard | « Kartaa » en blanc sur bleu nuit | QR Code |
| Premium | « Kartaa » en lettrage fin sur noir satiné | QR Code |
| VIP | « Kartaa » doré sur noir profond, liseré or | QR Code |

C'est tout. Pas de nom, pas de photo, pas de logo, pas de téléphone, pas de
métier, pas de réseaux — et au verso, aucun texte, pas même une adresse ou un
« scannez-moi ». Un QR Code se reconnaît sans légende.

Ces informations n'ont pas disparu : elles vivent dans le profil, dans la base
et sur le mini-site public, qui est précisément ce que le QR Code ouvre. La
photo, le logo et les coordonnées continuent de s'y afficher.

### Pourquoi la carte a son propre composant

`src/components/card/CardArtwork.jsx` ne lit du `card` que son modèle. Rien
d'autre n'y entre : pas de profil, pas de compte, pas de thème. C'est cette
frontière qui garantit qu'une modification du profil ne peut ni déplacer quoi
que ce soit sur la carte, ni y faire réapparaître une information.

Les trois habillages sont figés dans ce fichier. Les couleurs et la typographie
choisies dans l'assistant habillent le mini-site public — l'écran le dit —, pas
la carte : une carte Standard ressemble toujours à une carte Standard.

### Le QR Code

Il pointe vers l'adresse publique de référence (`kartaa-eight.vercel.app/<votre-adresse>`),
jamais vers celle du navigateur : un code imprimé depuis une préproduction
resterait coincé dessus.

Il est **vectoriel** sur la carte : le dessin est recalculé à la résolution du
fichier produit, donc net à l'impression quelle que soit la taille. Le
téléchargement du code seul reste une image `.png`, forme attendue par la
plupart des usages.

Il occupe 328 px de côté sur une carte de 1050 px, soit environ 26 mm sur une
carte de 85 mm — bien au-dessus des 20 mm en dessous desquels un téléphone
commence à peiner. Il est posé sur une plaque blanche : les trois modèles sont
sombres, et sans ce blanc aucun ne se laisserait scanner. La lisibilité passe
avant l'esthétique, toujours.

### Vérification

```bash
npm run build && npm run preview -- --port 4173
npm run test:carte
```

Pour chacun des trois modèles, avec un compte volontairement rempli (nom, photo,
métier, entreprise, téléphone, e-mail, réseaux) : le recto n'affiche que
« Kartaa » au mot près, le verso aucun texte, aucune de ces informations
n'apparaît sur l'une des deux faces, aucun pixel de la photo non plus, et le QR
Code lu dans le fichier téléchargé ouvre bien le profil public attendu.

## Sans réseau

Kartaa s'ouvre et reste utilisable sans connexion. Pas complètement : une partie
du produit a réellement besoin du serveur, et l'application le dit au lieu de
faire semblant.

### Ce qui fonctionne sans réseau

| | Sans réseau |
| --- | --- |
| Ouvrir l'application | oui, elle démarre |
| Voir ses cartes et leur QR Code | oui — le QR est dessiné sur l'appareil |
| Modifier une carte existante | oui : enregistrée ici, envoyée au retour du réseau |
| Rouvrir un mini-site **déjà consulté** sur cet appareil | oui, avec un bandeau |
| Ouvrir l'écran du scanner | oui |
| Créer une **première** carte | non : le serveur attribue l'adresse publique |
| Ouvrir un mini-site **jamais consulté** ici | non : il n'a jamais été téléchargé |
| Statistiques, paiement, téléversement d'images | non |

Les deux derniers cas ne sont pas silencieux : l'écran explique qu'une connexion
est nécessaire, et la saisie en cours n'est jamais perdue.

### Où les données sont rangées

Dans **IndexedDB** (`src/lib/offline/db.js`), pas dans `localStorage` : trois
magasins, `cartes`, `profils` (les mini-sites déjà ouverts) et `attente` (les
modifications pas encore parties).

N'y entrent jamais : aucun mot de passe, aucun code de récupération, aucun
fichier privé. Ce qui y est rangé est exactement ce que la personne connectée a
déjà sous les yeux, et les mini-sites sont publics par nature.

Le service worker garde en plus les images de l'espace public `card-assets`
(soixante au maximum, les plus anciennes partent en premier). Rien d'autre du
serveur n'entre dans un cache : ni appels d'API, ni jetons, ni URL signées.

### Le serveur reste la source de vérité

Chaque lecture réussie écrit au passage ce qu'elle a obtenu ; chaque lecture
impossible relit cette copie et le signale (`local: true`), ce qui allume le
bandeau « Mode hors connexion — dernières données disponibles ». Rien n'est
inventé : si rien n'a jamais été enregistré, l'écran affiche qu'une connexion
est nécessaire.

Une requête partie vers un serveur injoignable ne revient parfois **jamais** —
ni réponse, ni erreur. Toute lecture est donc bornée (huit secondes, vingt pour
une écriture), et quand le navigateur annonce lui-même l'absence de réseau, rien
n'est envoyé du tout. Sans cette borne, l'écran attendait indéfiniment une
réponse qui ne viendrait pas au lieu d'afficher la copie locale.

### La file d'attente, et les conflits

Une modification faite sans réseau est rangée dans `attente` avec l'heure à
laquelle elle a été faite, puis appliquée à la copie locale — ce que l'écran
montre est donc vrai : c'est bien enregistré sur l'appareil.

Au retour du réseau (évènement `online`, ou simple retour au premier plan), la
file est vidée dans l'ordre. Chaque opération part, puis est **retirée** : elle
ne peut pas être envoyée deux fois. Le premier échec réseau arrête la boucle —
on réessaiera plutôt que de marteler un serveur injoignable. Remplacer la liste
complète des liens est idempotent : la rejouer donne le même résultat.

La règle de conflit est volontairement simple :

- si la carte a été modifiée **ailleurs après** la modification locale, la
  version du serveur est gardée et l'opération est marquée « conflit ». Rien
  n'est écrasé en silence ;
- si le serveur **refuse** (droits, validation, adresse déjà prise), l'opération
  est marquée « refusée » avec son motif : la garder ne servirait à rien,
  elle serait refusée à l'identique.

L'indicateur d'en-tête ne dit que ce qui est vrai : « Hors connexion »,
« À synchroniser (n) », « Synchronisation… », et « Synchronisé » seulement quand
la file est réellement vide.

À la déconnexion, la base locale est effacée : rien ne reste lisible sur
l'appareil.

### Vérification

`npm run test:offline` rejoue les huit scénarios dans un vrai navigateur avec
une vraie coupure (`context.setOffline`) : démarrage, cartes, QR Code,
modification, retour du réseau (envoyée **une seule fois**), mini-site déjà
consulté, mini-site jamais consulté, scanner. La photo du mini-site est servie
par un vrai serveur, parce que les requêtes d'un service worker échappent aux
interceptions de Playwright : le test vérifie qu'elle est réellement rangée dans
son cache, et pas seulement affichée.

## Gratuit et Pro

Un seul produit payant : **Pro, 5 000 FCFA par mois**. Premium et VIP sont des
styles de cartes, pas des offres ; le coffre, le scanner, le NFC et le domaine
n'ont pas d'abonnement à eux.

| Gratuit | Pro |
| --- | --- |
| 1 carte, modèle Standard, filigrane « Powered by Kartaa » au verso | Plusieurs cartes, modèles Premium et VIP, **aucun filigrane** |
| Mini-site public complet : coordonnées, WhatsApp, e-mail, services | Galerie photos, plusieurs activités, couleurs et typographie |
| WhatsApp, TikTok, YouTube, LinkedIn, Snapchat, sites web et liens sans limite | **Facebook, Instagram, Telegram, X** |
| Profil personnel : nom, profession, coordonnées | **Informations d'entreprise** : structure, logo, adresse, site |
| Scanner universel et historique | Statistiques avancées |
| 1 coffre, 200 Mo | Plusieurs coffres, 20 Go |
| Application installable, français et anglais | — |

Le domaine personnalisé et le QR Code personnalisé ne sont **plus vendus** :
le premier n'a pas de vérification DNS réelle, le second n'existe pas. Ils
étaient annoncés dans l'offre sans être implémentés.

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
   entreprises, activités multiples, couleurs et typographie — sont refusées par
   un déclencheur sur `cards`. Il ne bloque que ce qui *augmente* ou ce qui
   *change* : un compte qui repasse en gratuit garde ses données et peut
   toujours les corriger.
3. **Les statistiques avancées** répondent `{"locked":"pro"}` au lieu de
   chiffres.
4. **Facebook, Instagram, Telegram et X** sont refusés par
   `set_card_social_links()`, qui compare le plan effectif du propriétaire. La
   liste vit dans `pro_social_platforms()`, en base, et doit rester alignée sur
   `PRO_SOCIAL_KEYS` côté application. Un compte gratuit peut garder, renommer
   et supprimer un compte déjà enregistré ; il ne peut ni en ajouter, ni
   repointer une adresse existante vers une autre.
5. **La mention Kartaa du mini-site** suit `ownerPlan`, calculé par
   `card_by_slug()` avec `plan_of()`. Elle ne dépend d'aucune valeur venue du
   navigateur.

### Les filigranes de la carte, et ce qu'ils protègent vraiment

Une carte gratuite porte, **sur ses deux faces**, un semis de « Kartaa » répété
en diagonale — une soixantaine d'occurrences — plus une ligne « Powered by
Kartaa » en bas. L'abonnement Pro retire tout cela, de l'aperçu comme des
fichiers PNG, JPG et PDF : c'est le même rendu qui sert aux deux.

Le filigrane suit **l'abonnement, jamais le modèle de carte**. Un abonné qui
garde la carte Standard l'a donc propre, exactement comme s'il avait choisi
Premium ou VIP ; et toutes ses cartes le sont, pas seulement la première. Un
compte gratuit n'a qu'une carte (`plan_limits`), et elle porte les filigranes.

**Le QR Code reste scannable, sans exception.** Au verso, le semis est dessiné
avant la plaque blanche du code, donc derrière elle ; la plaque étant opaque, ni
le code ni sa zone calme ne sont jamais recouverts. Le test `offres-check`
décode réellement le code depuis l'image produite, filigranes compris.

L'intensité tient dans une seule constante, `FILIGRANE` dans
`components/card/CardArtwork.jsx` : `opacite` est le seul curseur à toucher pour
les rendre plus ou moins présents.

Le plan qui décide vient de la colonne `profiles.plan`, que le navigateur ne
peut pas écrire, et son échéance est vérifiée. Trafiquer une valeur dans
l'application ne donne donc rien : la page rechargée relit `free`.

**Ce que cela ne couvre pas, et il faut le dire :** l'export est fabriqué par le
navigateur à partir du rendu de la page. Quelqu'un qui modifie le code de sa
propre page peut produire un fichier sans la mention. Le rendre impossible
demanderait de fabriquer l'image côté serveur. Tant que ce n'est pas fait, la
protection réelle porte sur le plan lui-même, sur les données Pro, et sur le
mini-site public — dont la mention est décidée par la base.

Le nombre de cartes, de coffres et le quota de stockage étaient déjà tenus par
`plan_limits()` et ses déclencheurs ; rien n'y a changé.

### Le paiement, et la seule voie vers Pro

Le paiement passe par Chariow : `ffnigord.mychariow.shop/prd_dv4ahcby`. Ouvrir
cette page n'accorde rien. **Rien de ce qui vient du navigateur ne prouve un
paiement** — ni un clic, ni un retour de page, ni un paramètre d'URL.

Le seul chemin vers Pro :

```
paiement chez Chariow
      ↓  notification signée (Pulse)
fonction Edge chariow-webhook   ← vérifie la signature HMAC du corps reçu
      ↓
activate_pro(email, 30 jours)   ← prolonge l'échéance, journalise, refuse un doublon
```

Le rattachement se fait par **l'adresse e-mail du paiement** : Chariow la
collecte toujours, et l'écran rappelle de payer avec celle du compte.

`profiles.pro_until` porte l'échéance ; `current_plan()` et `plan_of()` ne
renvoient `pro` que si elle est dans le futur. **Un abonnement échu perd donc ses
droits partout automatiquement** — limites de cartes et de coffres, modèles,
galerie, domaine, statistiques : tout passe déjà par ces deux fonctions.

#### À configurer une fois

1. Dans Chariow → Automations → Pulses : une notification vers
   `https://wadapjshbdjkjrfnsnyr.supabase.co/functions/v1/chariow-webhook`,
   abonnée à `successful_sale`, `license_expired` et `license_revoked`.
2. Copier le secret affiché (`whsec_…`) dans le secret Supabase
   `CHARIOW_PULSE_SECRET`. Sans lui, la fonction refuse tout (401) — c'est
   voulu : sans signature vérifiée, n'importe qui s'offrirait un abonnement en
   appelant cette adresse.

Pour activer un compte à la main : `select set_user_plan('<id>', 'pro');`.

### Aucun paiement n'est simulé

La page d'abonnement écrivait autrefois directement `plan = 'pro'` : un paiement
réussi qui n'avait jamais eu lieu.

Aujourd'hui, le bouton ouvre la page de paiement du prestataire (Chariow). Le
retour du navigateur n'accorde rien — il est sous le contrôle du visiteur, donc
sans valeur comme preuve. Seule la confirmation signée envoyée par le
prestataire à `supabase/functions/chariow-webhook` active l'abonnement, après
vérification de sa signature HMAC, en appelant `activate_pro()` côté serveur.

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

Il vérifie aussi ce que les fichiers ne contiennent pas : la photo du compte,
pourtant bien présente dans le profil, ne doit apparaître sur aucune des deux
faces (voir « La carte : deux faces, rien de plus »).

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

> **Ce script est périmé et ne passe plus.** Il a été écrit avant le passage à
> Supabase : il lit encore la base locale du prototype (`kartaa.db.v1`), attend
> des identifiants `crd_`/`vlt_`, et déroule le Coffre Sécurité, retiré de
> l'application depuis. Il est conservé pour mémoire, à réécrire. Les contrôles
> qui font foi aujourd'hui sont les suivants (`test:profil`, `test:vitrine`,
> `test:carte`, `test:nfc`, `test:deconnexion`, `test:offline`, `test:pwa`,
> `test:session`, `test:plan`, `test:export`, `test:photo`, `test:scanner`,
> `test:maj`).

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

- **Paiement** : branché. `/app/abonnement` ouvre la page de paiement de
  Chariow, et c'est la confirmation signée du prestataire, reçue par
  `chariow-webhook`, qui active l'abonnement — jamais un retour de navigateur.
  Le montant est de **5 000 FCFA par mois**. Ce qui reste à faire : configurer
  le Pulse et le secret `CHARIOW_PULSE_SECRET` sur un nouveau projet.
- **Impression physique** : le formulaire enregistre la demande ; il reste à la
  transmettre à un imprimeur.
- **Domaine personnalisé** : l'interface enregistre le domaine et affiche les
  instructions DNS. La vérification demande une intégration côté hébergeur.
