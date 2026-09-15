/**
 * Installation et mises à jour de l'application.
 *
 * Quatre choses que ce fichier doit faire dans le bon ordre, sous peine de
 * rendre l'installation introuvable :
 *
 * 1. enregistrer le service worker DÈS le premier chargement. Chrome n'émet
 *    beforeinstallprompt qu'une fois un service worker enregistré ; s'il ne
 *    l'est pas, l'installation n'est jamais proposée. L'enregistrement était
 *    accroché à l'évènement « load » — or quand la page se charge vite, « load »
 *    est déjà passé au moment où ce module s'exécute, l'écouteur n'est jamais
 *    appelé, et il fallait alors recharger la page pour que l'installation
 *    devienne possible. On regarde donc l'état du document plutôt que d'attendre
 *    un évènement peut-être déjà émis.
 *
 * 2. capter beforeinstallprompt au démarrage : il n'est émis qu'une fois par
 *    chargement, et souvent avant que le composant qui voudrait l'écouter soit
 *    monté.
 *
 * 3. dire honnêtement ce que le navigateur permet. Safari sur iPhone et Firefox
 *    n'émettent jamais cet évènement : sur ces navigateurs, l'installation
 *    existe mais passe par le menu. Prétendre le contraire donne un bouton qui
 *    ne fait rien.
 *
 * 4. proposer les mises à jour sans les imposer : une application installée sert
 *    sa version en cache jusqu'à ce qu'un nouveau service worker prenne la main.
 */

const CLE_REFUS = 'kartaa.pwa.refus'
const CLE_VISITES = 'kartaa.pwa.visites'
const JOURS_AVANT_NOUVELLE_PROPOSITION = 21

let propositionNative = null
// Une proposition refusée ne peut pas être rejouée : la spécification interdit
// de réutiliser l'évènement. On s'en souvient pour continuer d'indiquer le
// chemin manuel plutôt que de laisser l'écran muet.
let propositionRefusee = false
const abonnesInstallation = new Set()
const abonnesMiseAJour = new Set()

function lire(cle) {
  try {
    return window.localStorage.getItem(cle)
  } catch {
    return null
  }
}

function ecrire(cle, valeur) {
  try {
    window.localStorage.setItem(cle, valeur)
  } catch {
    /* navigateur sans stockage : l'invitation réapparaîtra, tant pis */
  }
}

/** Vrai si la page tourne déjà comme application installée. */
export function estInstallee() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true
  )
}

/**
 * Le bandeau flottant ne doit pas s'imposer à chaque visite : un refus le
 * repousse de trois semaines.
 *
 * Ce délai ne vaut QUE pour le bandeau. Le bouton « Installer l'application »,
 * lui, reste accessible en permanence depuis le profil : attendre une deuxième
 * visite pour rendre l'installation possible revenait à la cacher.
 */
export function peutProposerBandeau() {
  if (estInstallee()) return false
  const refusLe = Number(lire(CLE_REFUS) || 0)
  return !(refusLe && Date.now() - refusLe < JOURS_AVANT_NOUVELLE_PROPOSITION * 86400000)
}

/** Nombre de visites, seulement pour la mesure — il ne conditionne plus rien. */
export function visites() {
  return Number(lire(CLE_VISITES) || 0)
}

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent)

/**
 * Fenêtre intégrée à une autre application (Facebook, Messenger, Instagram,
 * WhatsApp, TikTok…). Elle n'installe jamais : c'est la première cause de
 * « ça marche sur mon téléphone mais pas sur le sien », puisqu'un lien partagé
 * s'y ouvre par défaut.
 */
const SIGNATURES_INTEGREES = [
  'FBAN', 'FBAV', 'FB_IAB', 'Instagram', 'Messenger',
  'Line/', 'MicroMessenger', 'TikTok', 'Twitter', 'Snapchat',
]

export function estFenetreIntegree() {
  const agent = ua()
  if (!agent) return false
  if (SIGNATURES_INTEGREES.some((signature) => agent.includes(signature))) return true
  return /\bwv\b/.test(agent) && /Android/.test(agent)
}

function estIos() {
  return /iPad|iPhone|iPod/.test(ua())
    || (/Macintosh/.test(ua()) && typeof document !== 'undefined' && 'ontouchend' in document)
}

/**
 * Ce que le navigateur permet réellement, ici et maintenant :
 *
 *   « installee » — la page tourne déjà comme application ;
 *   « native »    — le navigateur a proposé son mécanisme, un clic suffit ;
 *   « ios »       — Safari : passer par Partager → Sur l'écran d'accueil ;
 *   « manuel »    — Firefox et consorts : par le menu du navigateur ;
 *   « attente »   — le navigateur peut encore émettre sa proposition.
 */
export function modeInstallation() {
  if (estInstallee()) return 'installee'
  if (propositionNative) return 'native'
  if (estFenetreIntegree()) return 'fenetre-integree'
  if (estIos()) return 'ios'
  if (propositionRefusee || /Firefox/.test(ua())) return 'manuel'
  return 'attente'
}

/**
 * Pourquoi l'installation automatique n'est pas proposée, en un coup d'œil.
 *
 * Deux téléphones ouvrant la même adresse peuvent se comporter différemment :
 * le manifeste et les icônes sont les mêmes pour tout le monde, c'est l'état du
 * navigateur qui change. Plutôt que de laisser l'écran muet — ou pire, de
 * conseiller un rechargement qui n'y changera rien — on nomme la raison.
 */
export function raisonInstallation() {
  switch (modeInstallation()) {
    case 'installee':
      return 'Elle est déjà installée sur cet appareil.'
    case 'fenetre-integree':
      return "Vous êtes dans la fenêtre d'une autre application, qui n'installe jamais. Ouvrez le site dans Chrome."
    case 'ios':
      return "Safari n'ouvre pas de fenêtre d'installation : elle se fait par le bouton Partager."
    case 'manuel':
      return "Ce navigateur n'ouvre pas de fenêtre d'installation : elle se fait par son menu."
    case 'attente':
      return "Votre navigateur ne l'a pas encore proposée. Sur Android, elle apparaît dans Chrome."
    default:
      return null
  }
}

/** Ce que le navigateur a réellement en place, pour le diagnostic à l'écran. */
export async function etatPwa() {
  const enregistrement = 'serviceWorker' in navigator
    ? await navigator.serviceWorker.getRegistration().catch(() => null)
    : null
  return {
    mode: modeInstallation(),
    raison: raisonInstallation(),
    installee: estInstallee(),
    fenetreIntegree: estFenetreIntegree(),
    https: window.location.protocol === 'https:' || window.location.hostname === 'localhost',
    serviceWorker: !!enregistrement,
    serviceWorkerActif: !!enregistrement?.active,
    controle: !!navigator.serviceWorker?.controller,
    propositionRecue: !!propositionNative,
    visites: visites(),
  }
}

export function noterRefusInstallation() {
  ecrire(CLE_REFUS, String(Date.now()))
}

export function propositionDisponible() {
  return !!propositionNative
}

/** Déclenche la proposition du navigateur. Retourne true si elle a été acceptée. */
export async function proposerInstallation() {
  if (!propositionNative) return false
  const invite = propositionNative
  propositionNative = null
  invite.prompt()
  const { outcome } = await invite.userChoice
  if (outcome !== 'accepted') {
    propositionRefusee = true
    noterRefusInstallation()
  }
  abonnesInstallation.forEach((rappel) => rappel())
  return outcome === 'accepted'
}

export function surInstallationPossible(rappel) {
  abonnesInstallation.add(rappel)
  if (propositionNative) rappel()
  return () => abonnesInstallation.delete(rappel)
}

export function surMiseAJourDisponible(rappel) {
  abonnesMiseAJour.add(rappel)
  return () => abonnesMiseAJour.delete(rappel)
}

let enAttente = null

/** Applique la version en attente, puis recharge — jamais sans demande explicite. */
export function appliquerMiseAJour() {
  if (!enAttente) return
  enAttente.postMessage('appliquer-la-mise-a-jour')
}

/**
 * À appeler une fois au démarrage. Enregistre le service worker, compte la
 * visite et surveille l'arrivée d'une nouvelle version.
 */
export function initialiserPwa() {
  if (typeof window === 'undefined') return

  ecrire(CLE_VISITES, String(Number(lire(CLE_VISITES) || 0) + 1))

  window.addEventListener('beforeinstallprompt', (evenement) => {
    // preventDefault empêche la bannière automatique de Chrome : c'est notre
    // bouton qui déclenchera la proposition, au moment choisi par la personne.
    evenement.preventDefault()
    propositionNative = evenement
    propositionRefusee = false
    abonnesInstallation.forEach((rappel) => rappel())
  })

  window.addEventListener('appinstalled', () => {
    propositionNative = null
    propositionRefusee = false
    abonnesInstallation.forEach((rappel) => rappel())
  })

  // Une application peut être installée depuis une autre fenêtre, ou lancée
  // depuis son icône : l'écran doit suivre sans recharger.
  window.matchMedia?.('(display-mode: standalone)')
    ?.addEventListener?.('change', () => abonnesInstallation.forEach((rappel) => rappel()))

  if (!('serviceWorker' in navigator)) return

  /**
   * Enregistre le service worker sans attendre un évènement déjà passé.
   *
   * L'enregistrement était accroché à « load ». Quand la page se charge vite —
   * ressources en cache, deuxième visite, connexion correcte — « load » est
   * déjà émis au moment où ce module s'exécute : l'écouteur ne se déclenchait
   * jamais, aucun service worker n'était enregistré, et Chrome n'avait donc
   * aucune raison de proposer l'installation. Recharger la page réglait le
   * problème par hasard, en repassant par un chargement plus lent.
   */
  const enregistrer = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((enregistrement) => {
        const surveiller = (worker) => {
          if (!worker) return
          worker.addEventListener('statechange', () => {
            // « installed » avec un contrôleur déjà en place = une nouvelle
            // version attend son tour.
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              enAttente = worker
              abonnesMiseAJour.forEach((rappel) => rappel())
            }
          })
        }

        if (enregistrement.waiting && navigator.serviceWorker.controller) {
          enAttente = enregistrement.waiting
          abonnesMiseAJour.forEach((rappel) => rappel())
        }
        surveiller(enregistrement.installing)
        enregistrement.addEventListener('updatefound', () => surveiller(enregistrement.installing))
      })
      .catch(() => {
        /* pas de service worker : l'application fonctionne, sans hors-ligne */
      })

    let rechargee = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (rechargee) return
      rechargee = true
      window.location.reload()
    })
  }

  if (document.readyState === 'complete') enregistrer()
  else window.addEventListener('load', enregistrer, { once: true })
}
