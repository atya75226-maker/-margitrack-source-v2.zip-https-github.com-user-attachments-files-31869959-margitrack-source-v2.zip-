/**
 * Coffres déverrouillés pendant la session.
 *
 * Deux choses y vivent, et uniquement en mémoire — jamais localStorage, jamais
 * IndexedDB :
 *
 *   la CLÉ du coffre, qui déchiffre les fichiers dans le navigateur ;
 *   le JETON de session, qui autorise le serveur à lister les fichiers et à
 *   signer leurs URL pour quelqu'un qui n'a pas de compte.
 *
 * Un rechargement de page, la fermeture de l'onglet ou l'expiration du délai
 * d'inactivité les efface, et le coffre redemande son mot de passe.
 */

const IDLE_TIMEOUT_MS = 15 * 60 * 1000
const sessions = new Map()

export function unlock(vaultId, key, token = null) {
  sessions.set(vaultId, { key, token, at: Date.now() })
}

function entryOf(vaultId) {
  const entry = sessions.get(vaultId)
  if (!entry) return null
  if (Date.now() - entry.at > IDLE_TIMEOUT_MS) {
    sessions.delete(vaultId)
    return null
  }
  entry.at = Date.now()
  return entry
}

export function getKey(vaultId) {
  return entryOf(vaultId)?.key || null
}

export function getToken(vaultId) {
  return entryOf(vaultId)?.token || null
}

export function lock(vaultId) {
  sessions.delete(vaultId)
}

export function lockAll() {
  sessions.clear()
}
