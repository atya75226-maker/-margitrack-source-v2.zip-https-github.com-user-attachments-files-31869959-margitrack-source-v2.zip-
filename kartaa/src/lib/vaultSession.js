/**
 * Coffres déverrouillés pendant la session.
 *
 * Les clés ne vivent qu'en mémoire (jamais localStorage, jamais IndexedDB) :
 * un rechargement de page, la fermeture de l'onglet ou l'expiration du délai
 * d'inactivité les fait disparaître, et le coffre redemande une authentification.
 */

const IDLE_TIMEOUT_MS = 15 * 60 * 1000
const sessions = new Map()

export function unlock(vaultId, key) {
  sessions.set(vaultId, { key, at: Date.now() })
}

export function getKey(vaultId) {
  const entry = sessions.get(vaultId)
  if (!entry) return null
  if (Date.now() - entry.at > IDLE_TIMEOUT_MS) {
    sessions.delete(vaultId)
    return null
  }
  entry.at = Date.now()
  return entry.key
}

export function lock(vaultId) {
  sessions.delete(vaultId)
}

export function lockAll() {
  sessions.clear()
}
