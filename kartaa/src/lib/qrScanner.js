/**
 * Lecture de QR Codes.
 *
 * Deux moteurs, dans cet ordre :
 *  1. BarcodeDetector, intégré à Chrome sur Android — rapide, sans rien télécharger ;
 *  2. jsQR, chargé à la demande pour les navigateurs qui ne l'ont pas (dont Safari).
 *
 * Le scanner est universel : il lit n'importe quel QR Code, pas seulement ceux
 * de Kartaa. Ce qu'on en fait ensuite dépend du contenu (voir interpretScan).
 */

let detector = null
let jsQrModule = null

export function hasNativeDetector() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

async function nativeDetector() {
  if (detector) return detector
  try {
    const formats = await window.BarcodeDetector.getSupportedFormats()
    if (!formats.includes('qr_code')) return null
    detector = new window.BarcodeDetector({ formats: ['qr_code'] })
    return detector
  } catch {
    return null
  }
}

async function decodeWithJsQr(imageData) {
  if (!jsQrModule) jsQrModule = (await import('jsqr')).default
  const result = jsQrModule(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  })
  return result?.data || null
}

/** Cherche un QR Code dans une image vidéo ou fixe. Retourne le texte, ou null. */
export async function decodeFrame(source, canvas) {
  if (hasNativeDetector()) {
    const engine = await nativeDetector()
    if (engine) {
      try {
        const codes = await engine.detect(source)
        if (codes.length) return codes[0].rawValue
        return null
      } catch {
        /* on retombe sur jsQR */
      }
    }
  }

  const width = source.videoWidth || source.naturalWidth || source.width
  const height = source.videoHeight || source.naturalHeight || source.height
  if (!width || !height) return null

  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(source, 0, 0, width, height)
  return decodeWithJsQr(context.getImageData(0, 0, width, height))
}

/** Lit un QR Code dans un fichier image choisi par l'utilisateur. */
export async function decodeFile(file) {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  const texte = await decodeFrame(bitmap, canvas)
  bitmap.close?.()
  return texte
}

/* ------------------------------------------------------------ interprétation */

/**
 * Reconnaît une adresse Kartaa, quel que soit le domaine de déploiement.
 * Un QR Code créé sur une préproduction reste un lien Kartaa : on l'ouvre sur
 * le domaine courant, là où la session de l'utilisateur existe.
 */
const DOMAINES_KARTAA = /^kartaa[\w-]*\.vercel\.app$/i

export function isKartaaHost(hostname = '') {
  if (typeof window !== 'undefined' && hostname === window.location.hostname) return true
  return DOMAINES_KARTAA.test(hostname)
}

/**
 * Que faire du contenu lu ?
 *  - une carte Kartaa  → on ouvre le mini-site sans quitter l'application
 *  - un coffre Kartaa  → on ouvre son écran de déverrouillage
 *  - une autre adresse → on propose de l'ouvrir
 *  - un contact vCard  → on propose de l'enregistrer
 *  - autre chose       → on affiche le texte, copiable
 */
export function interpretScan(raw) {
  const value = (raw || '').trim()
  if (!value) return { kind: 'empty', value }

  if (/^BEGIN:VCARD/i.test(value)) {
    const nom = value.match(/\nFN:(.+)/i)?.[1]?.trim()
    return { kind: 'vcard', value, label: nom || 'Fiche contact' }
  }

  let url
  try {
    url = new URL(value)
  } catch {
    if (/^\+?[\d\s().-]{6,}$/.test(value)) return { kind: 'phone', value }
    return { kind: 'text', value }
  }

  // Un QR Code créé sur un autre domaine de déploiement reste un lien Kartaa :
  // on l'ouvre ici, sur le domaine courant, pour que la session serve.
  const interne = isKartaaHost(url.hostname)
  const segments = url.pathname.split('/').filter(Boolean)

  if (interne && segments.length === 2 && segments[0] === 'c') {
    return { kind: 'vault', value, route: `/c/${segments[1]}` }
  }
  if (interne && segments.length === 1 && !['app', 'connexion', 'inscription', 'auth'].includes(segments[0])) {
    return { kind: 'card', value, route: `/${segments[0]}`, label: segments[0] }
  }
  if (interne) return { kind: 'internal', value, route: url.pathname + url.search }

  return { kind: 'url', value, label: url.host }
}

/* -------------------------------------------------------------- historique */

const HISTORY_KEY = 'kartaa.scans.v1'
const HISTORY_MAX = 20

export function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []
  } catch {
    return []
  }
}

export function pushHistory(entry) {
  try {
    const current = readHistory().filter((item) => item.value !== entry.value)
    const next = [{ ...entry, at: new Date().toISOString() }, ...current].slice(0, HISTORY_MAX)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    return next
  } catch {
    return readHistory()
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    /* stockage indisponible */
  }
  return []
}
