/**
 * Déverrouillage biométrique (WebAuthn).
 *
 * Aucune empreinte digitale n'entre jamais dans l'application : le capteur reste
 * géré par le système d'exploitation, qui ne renvoie qu'une signature.
 *
 * Deux niveaux, selon ce que l'appareil supporte :
 *  1. extension PRF — le secret qui déchiffre la clé du coffre est **dérivé** de la
 *     biométrie ; rien d'exploitable n'est stocké ;
 *  2. repli — la clé du coffre est enveloppée par un secret aléatoire lié à
 *     l'appareil ; l'assertion biométrique conditionne son utilisation.
 * Dans les deux cas, le mot de passe reste le secret de référence du coffre.
 */

import { toBase64, fromBase64, randomBytes } from './crypto'

export function isSupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials
}

export async function isPlatformAuthenticatorAvailable() {
  if (!isSupported()) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

const RP_NAME = 'Kartaa — Coffre Sécurité'

/** Enrôle l'appareil pour un coffre. Retourne de quoi reconstituer le secret. */
export async function enroll({ vaultId, vaultName, userLabel }) {
  if (!isSupported()) throw new Error("Cet appareil ne propose pas d'authentification biométrique.")
  const prfSalt = randomBytes(32)
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: RP_NAME, id: window.location.hostname },
      user: { id: new TextEncoder().encode(vaultId), name: userLabel || vaultName, displayName: vaultName },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
      attestation: 'none',
      extensions: { prf: { eval: { first: prfSalt } } },
    },
  })
  if (!credential) throw new Error('Enrôlement biométrique annulé.')
  const results = credential.getClientExtensionResults?.()
  const prfSupported = !!results?.prf?.enabled
  return {
    credentialId: toBase64(credential.rawId),
    prfSalt: toBase64(prfSalt),
    prfSupported,
    enrolledAt: new Date().toISOString(),
  }
}

/**
 * Demande l'assertion biométrique.
 * Retourne le secret PRF (mode 1) ou null (mode 2, secret conservé localement).
 */
export async function assert(biometric) {
  if (!isSupported()) throw new Error("Cet appareil ne propose pas d'authentification biométrique.")
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: biometric.credentialId
        ? [{ type: 'public-key', id: fromBase64(biometric.credentialId) }]
        : [],
      userVerification: 'required',
      timeout: 60_000,
      extensions: biometric.prfSalt ? { prf: { eval: { first: fromBase64(biometric.prfSalt) } } } : undefined,
    },
  })
  if (!assertion) throw new Error('Authentification biométrique annulée.')
  const prf = assertion.getClientExtensionResults?.()?.prf?.results?.first
  return prf ? toBase64(prf) : null
}

/* Secret de repli lié à l'appareil (mode 2). */
const DEVICE_KEY = 'kartaa.device.secrets.v1'

export function storeDeviceSecret(vaultId, secret) {
  const all = readDeviceSecrets()
  all[vaultId] = secret
  localStorage.setItem(DEVICE_KEY, JSON.stringify(all))
}

export function getDeviceSecret(vaultId) {
  return readDeviceSecrets()[vaultId] || null
}

export function clearDeviceSecret(vaultId) {
  const all = readDeviceSecrets()
  delete all[vaultId]
  localStorage.setItem(DEVICE_KEY, JSON.stringify(all))
}

function readDeviceSecrets() {
  try {
    return JSON.parse(localStorage.getItem(DEVICE_KEY)) || {}
  } catch {
    return {}
  }
}
