/**
 * Stockage binaire local (IndexedDB).
 *
 * Les métadonnées (comptes, cartes, coffres) vivent dans localStorage ; les octets
 * — photos de profil, logos, fichiers du coffre — vivent ici, hors du quota étroit
 * de localStorage. Les fichiers d'un coffre y sont écrits **déjà chiffrés**.
 */

const DB_NAME = 'kartaa'
const DB_VERSION = 1
const STORE = 'blobs'

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

async function tx(mode, run) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const store = transaction.objectStore(STORE)
    const request = run(store)
    transaction.onerror = () => reject(transaction.error)
    if (request) {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    } else {
      transaction.oncomplete = () => resolve()
    }
  })
}

export const blobs = {
  /** Écrit des octets et retourne leur identifiant. */
  async put(id, { mime, data, encrypted = false, iv = null }) {
    await tx('readwrite', (store) => store.put({ id, mime, data, encrypted, iv, at: Date.now() }))
    return id
  },
  async get(id) {
    if (!id) return null
    return tx('readonly', (store) => store.get(id))
  },
  async remove(id) {
    if (!id) return
    await tx('readwrite', (store) => store.delete(id))
  },
  async clear() {
    await tx('readwrite', (store) => store.clear())
  },
}

/* URLs temporaires : créées à la demande, révoquées au verrouillage du coffre. */
const urlCache = new Map()

export async function objectUrl(id) {
  if (!id) return null
  if (urlCache.has(id)) return urlCache.get(id)
  const record = await blobs.get(id)
  if (!record) return null
  const url = URL.createObjectURL(new Blob([record.data], { type: record.mime || 'application/octet-stream' }))
  urlCache.set(id, url)
  return url
}

export function revokeUrl(id) {
  const url = urlCache.get(id)
  if (url) {
    URL.revokeObjectURL(url)
    urlCache.delete(id)
  }
}

export function revokeAllUrls() {
  urlCache.forEach((url) => URL.revokeObjectURL(url))
  urlCache.clear()
}

/** URL éphémère créée à partir d'octets déjà déchiffrés (jamais persistée). */
export function ephemeralUrl(bytes, mime) {
  return URL.createObjectURL(new Blob([bytes], { type: mime || 'application/octet-stream' }))
}
