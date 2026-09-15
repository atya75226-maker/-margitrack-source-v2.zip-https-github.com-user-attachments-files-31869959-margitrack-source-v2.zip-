/**
 * Socle des notifications — rien n'est envoyé aujourd'hui.
 *
 * Ce fichier prépare le terrain pour « votre carte a été consultée », « votre QR
 * Code a été scanné » ou un rappel d'abonnement, sans rien déclencher : la
 * permission n'est demandée qu'au moment où quelqu'un l'active lui-même, jamais
 * au chargement de l'application.
 *
 * Demander une permission sans raison visible est le meilleur moyen d'être
 * refusé définitivement : un navigateur qui a reçu un « non » ne repose plus la
 * question, et la fonctionnalité devient inaccessible pour toujours sur cet
 * appareil.
 */

const CLE_PREFERENCE = 'kartaa.notifications.souhaitees'

export function notificationsPrisesEnCharge() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
}

/** « default » (jamais demandé), « granted » ou « denied ». */
export function etatPermission() {
  if (!notificationsPrisesEnCharge()) return 'unsupported'
  return Notification.permission
}

export function notificationsSouhaitees() {
  try {
    return window.localStorage.getItem(CLE_PREFERENCE) === 'oui'
  } catch {
    return false
  }
}

function enregistrerPreference(souhaitees) {
  try {
    window.localStorage.setItem(CLE_PREFERENCE, souhaitees ? 'oui' : 'non')
  } catch {
    /* sans stockage, la préférence ne survit pas : sans conséquence ici */
  }
}

/**
 * Demande l'autorisation, sur geste explicite uniquement.
 * Retourne l'état obtenu.
 */
export async function activerNotifications() {
  if (!notificationsPrisesEnCharge()) return 'unsupported'
  const etat = await Notification.requestPermission()
  enregistrerPreference(etat === 'granted')
  return etat
}

export function desactiverNotifications() {
  // Le navigateur seul peut retirer une permission accordée ; côté application,
  // on cesse simplement de s'en servir.
  enregistrerPreference(false)
}
