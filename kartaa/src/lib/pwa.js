/**
 * Installation et mises à jour de l'application.
 *
 * Deux problèmes que ce fichier règle, et qu'on ne voit qu'une fois l'application
 * installée sur un téléphone :
 *
 * 1. beforeinstallprompt n'est émis qu'une seule fois par chargement, et tôt —
 *    souvent avant que le composant qui voudrait l'écouter soit monté. On le
 *    capte donc ici, au démarrage, et on le garde de côté.
 *
 * 2. une application installée continue de servir sa version en cache jusqu'à ce
 *    qu'un nouveau service worker prenne la main. Sans signal, la seule façon de
 *    recevoir une correction serait de fermer complètement l'application depuis
 *    le multitâche — ce qu'aucun utilisateur ne devine.
 */

const CLE_REFUS = 'kartaa.pwa.refus'
const CLE_VISITES = 'kartaa.pwa.visites'
const JOURS_AVANT_NOUVELLE_PROPOSITION = 21
const VISITES_AVANT_PROPOSITION = 2

let propositionNative = null
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
 * L'invitation ne doit pas apparaître à chaque visite : on attend une deuxième
 * visite, et un refus la repousse de trois semaines.
 */
export function peutProposerInstallation() {
  if (estInstallee()) return false
  const refusLe = Number(lire(CLE_REFUS) || 0)
  if (refusLe && Date.now() - refusLe < JOURS_AVANT_NOUVELLE_PROPOSITION * 86400000) return false
  return Number(lire(CLE_VISITES) || 0) >= VISITES_AVANT_PROPOSITION
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
  if (outcome !== 'accepted') noterRefusInstallation()
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
    evenement.preventDefault()
    propositionNative = evenement
    abonnesInstallation.forEach((rappel) => rappel())
  })

  window.addEventListener('appinstalled', () => {
    propositionNative = null
    abonnesInstallation.forEach((rappel) => rappel())
  })

  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
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
  })
}
