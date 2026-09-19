/**
 * Base locale de Kartaa (IndexedDB).
 *
 * Pourquoi IndexedDB et pas localStorage : localStorage est synchrone, limité à
 * quelques mégaoctets et ne stocke que du texte. On y garde le jeton de session,
 * rien de plus. Les cartes, les profils consultés et la file des modifications
 * en attente vivent ici.
 *
 * CE QUI N'ENTRE JAMAIS DANS CETTE BASE
 *
 *  - aucun mot de passe, aucun code de récupération ;
 *  - aucun fichier privé ;
 *  - rien qu'un visiteur du même appareil ne pourrait déjà voir dans
 *    l'application une fois la session ouverte.
 *
 * Ce qu'on y met est ce que le propriétaire voit de toute façon à l'écran : ses
 * cartes, et les profils publics qu'il a ouverts — des pages publiques par
 * nature.
 */

const NOM = 'kartaa'
const VERSION = 1

export const CARTES = 'cartes'
export const PROFILS = 'profils'
export const ATTENTE = 'attente'

let connexion = null

/** IndexedDB peut manquer : navigation privée, WebView bridée, stockage refusé. */
export function disponible() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

function ouvrir() {
  if (connexion) return connexion
  if (!disponible()) return Promise.resolve(null)

  connexion = new Promise((resoudre) => {
    let demande
    try {
      demande = indexedDB.open(NOM, VERSION)
    } catch {
      resoudre(null)
      return
    }

    demande.onupgradeneeded = () => {
      const base = demande.result
      // Les cartes du propriétaire, rangées par identifiant, retrouvables par compte.
      if (!base.objectStoreNames.contains(CARTES)) {
        const magasin = base.createObjectStore(CARTES, { keyPath: 'id' })
        magasin.createIndex('userId', 'userId', { unique: false })
      }
      // Les profils publics déjà ouverts, rangés par adresse.
      if (!base.objectStoreNames.contains(PROFILS)) {
        base.createObjectStore(PROFILS, { keyPath: 'slug' })
      }
      // Les modifications faites hors ligne, dans leur ordre d'arrivée.
      if (!base.objectStoreNames.contains(ATTENTE)) {
        base.createObjectStore(ATTENTE, { keyPath: 'id' })
      }
    }

    demande.onsuccess = () => resoudre(demande.result)
    demande.onerror = () => resoudre(null)
    demande.onblocked = () => resoudre(null)
  })

  return connexion
}

function transaction(magasin, mode, action) {
  return ouvrir().then((base) => {
    if (!base) return null
    return new Promise((resoudre) => {
      let tx
      try {
        tx = base.transaction(magasin, mode)
      } catch {
        resoudre(null)
        return
      }
      const demande = action(tx.objectStore(magasin))
      tx.oncomplete = () => resoudre(demande ? demande.result : null)
      tx.onerror = () => resoudre(null)
      tx.onabort = () => resoudre(null)
    })
  })
}

/* ------------------------------------------------------------- opérations */

export function lire(magasin, cle) {
  return transaction(magasin, 'readonly', (m) => m.get(cle))
}

export function ecrire(magasin, valeur) {
  return transaction(magasin, 'readwrite', (m) => m.put(valeur))
}

export function supprimer(magasin, cle) {
  return transaction(magasin, 'readwrite', (m) => m.delete(cle))
}

export function tout(magasin) {
  return transaction(magasin, 'readonly', (m) => m.getAll()).then((liste) => liste || [])
}

/** Remplace le contenu d'un magasin pour un compte donné, d'un seul coup. */
export function remplacerPour(magasin, userId, valeurs) {
  return ouvrir().then((base) => {
    if (!base) return null
    return new Promise((resoudre) => {
      let tx
      try {
        tx = base.transaction(magasin, 'readwrite')
      } catch {
        resoudre(null)
        return
      }
      const m = tx.objectStore(magasin)
      const demande = m.getAll()
      demande.onsuccess = () => {
        // On efface ce qui a disparu côté serveur, sans toucher aux autres comptes.
        const gardes = new Set(valeurs.map((valeur) => valeur.id))
        ;(demande.result || [])
          .filter((ligne) => ligne.userId === userId && !gardes.has(ligne.id))
          .forEach((ligne) => m.delete(ligne.id))
        valeurs.forEach((valeur) => m.put({ ...valeur, userId }))
      }
      tx.oncomplete = () => resoudre(true)
      tx.onerror = () => resoudre(null)
      tx.onabort = () => resoudre(null)
    })
  })
}

/** Les entrées d'un compte, dans l'ordre où elles ont été enregistrées. */
export function pour(magasin, userId) {
  return tout(magasin).then((liste) => liste.filter((ligne) => ligne.userId === userId))
}

/** Efface tout : appelé à la déconnexion, pour ne rien laisser derrière soi. */
export function vider() {
  return Promise.all([CARTES, PROFILS, ATTENTE].map((magasin) =>
    transaction(magasin, 'readwrite', (m) => m.clear()),
  ))
}
