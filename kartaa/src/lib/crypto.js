/**
 * Petits utilitaires du navigateur.
 *
 * Ce fichier contenait aussi les primitives du Coffre Sécurité — dérivation de
 * clé, chiffrement des fichiers, codes de récupération. Le coffre ayant quitté
 * l'application, elles ont été retirées avec lui : il ne reste ici que ce dont
 * les cartes se servent.
 */

export function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length))
}

/** Identifiant court et lisible pour une entrée créée dans le navigateur. */
export function randomId(prefix = '') {
  const bytes = randomBytes(9)
  let binaire = ''
  bytes.forEach((octet) => {
    binaire += String.fromCharCode(octet)
  })
  const brut = btoa(binaire).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)
  return prefix ? `${prefix}_${brut}` : brut
}

/** Indicateur de robustesse d'un mot de passe (0 → 4). */
export function passwordStrength(password = '') {
  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  return Math.min(4, score)
}

export const STRENGTH_LABELS = ['Très faible', 'Faible', 'Moyen', 'Bon', 'Excellent']
