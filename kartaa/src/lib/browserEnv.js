/**
 * Reconnaissance des navigateurs intégrés aux autres applications.
 *
 * Ouvrir un lien depuis Facebook, WhatsApp ou Instagram n'ouvre pas le navigateur
 * du téléphone : l'application affiche la page dans sa propre fenêtre, avec son
 * propre espace de stockage, souvent effacé à la fermeture. La session Kartaa
 * disparaît alors avec la fenêtre, et il faut se reconnecter à chaque visite.
 *
 * Rien dans notre code ne peut retenir une session que le navigateur jette : la
 * seule issue est d'ouvrir le site dans Chrome ou Safari, ou de l'installer sur
 * l'écran d'accueil. On se contente donc de le signaler au bon moment.
 */

const SIGNATURES = [
  'FBAN', 'FBAV', 'FB_IAB', 'Instagram', 'Messenger',
  'Line/', 'MicroMessenger', 'TikTok', 'Twitter', 'Snapchat',
]

export function isInAppBrowser(userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent) {
  if (!userAgent) return false
  if (SIGNATURES.some((signature) => userAgent.includes(signature))) return true
  // WhatsApp et plusieurs applications Android se contentent du marqueur « wv ».
  return /\bwv\b/.test(userAgent) && /Android/.test(userAgent)
}

/** Vrai si la page tourne déjà comme application installée. */
export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}
