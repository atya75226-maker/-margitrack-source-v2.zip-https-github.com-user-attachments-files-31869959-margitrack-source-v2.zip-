/**
 * Primitives de sécurité du Coffre Sécurité.
 *
 * Modèle :
 *  - chaque coffre possède une clé AES-256-GCM aléatoire (la « clé du coffre ») ;
 *  - cette clé n'est jamais stockée en clair : elle est chiffrée (wrappée) par une
 *    clé dérivée du mot de passe (PBKDF2-SHA256) et, séparément, par une clé dérivée
 *    du code de récupération ;
 *  - le serveur ne détient jamais le mot de passe : une seule dérivation PBKDF2
 *    produit 512 bits, dont la première moitié chiffre la clé du coffre (elle reste
 *    dans le navigateur) et la seconde sert de « vérificateur » envoyé au serveur,
 *    qui n'en conserve que l'empreinte SHA-256 ;
 *  - les fichiers sont chiffrés avec la clé du coffre avant d'être téléversés.
 */

const enc = new TextEncoder()

export const KDF_ITERATIONS = 210_000

/* ---------------------------------------------------------------- encodage */

export function toBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

export function fromBase64(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length))
}

export function randomSalt() {
  return toBase64(randomBytes(16))
}

export function randomId(prefix = '') {
  const raw = toBase64(randomBytes(9)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)
  return prefix ? `${prefix}_${raw}` : raw
}

/* ------------------------------------------------------------------ dérive */

/**
 * Une seule passe PBKDF2 pour deux usages distincts :
 *   bits[0..31]  → clé AES qui enveloppe la clé du coffre (ne quitte jamais l'appareil)
 *   bits[32..63] → vérificateur transmis au serveur pour autoriser l'ouverture
 * Le serveur ne peut rien déduire du vérificateur : il n'en garde que l'empreinte,
 * et la moitié qui déchiffre reste ici.
 */
export async function deriveVaultMaterial(passphrase, saltB64, iterations = KDF_ITERATIONS) {
  const material = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveBits'])
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: fromBase64(saltB64), iterations, hash: 'SHA-256' },
      material,
      512,
    ),
  )
  const wrappingKey = await crypto.subtle.importKey('raw', bits.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  return { wrappingKey, verifier: toBase64(bits.slice(32, 64)) }
}

/* -------------------------------------------------------------- chiffrement */

export async function encryptBytes(key, bytes) {
  const iv = randomBytes(12)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes)
  return { iv: toBase64(iv), data: cipher }
}

export async function decryptBytes(key, ivB64, cipher) {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(ivB64) }, key, cipher)
}

/* --------------------------------------------------------- clé de coffre */

export async function generateVaultKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

async function exportKeyRaw(key) {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key))
}

async function importKeyRaw(raw) {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
}

/** Enveloppe la clé du coffre avec un secret (mot de passe, code, secret biométrique). */
export async function wrapVaultKey(vaultKey, passphrase, saltB64 = randomSalt(), iterations = KDF_ITERATIONS) {
  const { wrappingKey, verifier } = await deriveVaultMaterial(passphrase, saltB64, iterations)
  const { iv, data } = await encryptBytes(wrappingKey, await exportKeyRaw(vaultKey))
  return { wrap: { iv, data: toBase64(data), salt: saltB64, iterations }, verifier, salt: saltB64 }
}

/** Déchiffre la clé du coffre avec une clé d'enveloppe déjà dérivée. */
export async function openWrappedKey(wrap, wrappingKey) {
  const raw = await decryptBytes(wrappingKey, wrap.iv, fromBase64(wrap.data))
  return importKeyRaw(raw)
}

/** Déchiffre la clé du coffre à partir du secret. Lève une erreur si le secret est faux. */
export async function unwrapVaultKey(wrap, passphrase, saltB64, iterations) {
  const salt = saltB64 || wrap.salt
  const rounds = iterations || wrap.iterations || KDF_ITERATIONS
  const { wrappingKey } = await deriveVaultMaterial(passphrase, salt, rounds)
  const raw = await decryptBytes(wrappingKey, wrap.iv, fromBase64(wrap.data))
  return importKeyRaw(raw)
}

/* ------------------------------------------------- code de récupération */

const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sans I, O, 0, 1

/** Génère un code du type 8K7P-42LM-X91Q. */
export function generateRecoveryCode(groups = 3, size = 4) {
  const bytes = randomBytes(groups * size)
  const chars = Array.from(bytes, (b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length])
  return Array.from({ length: groups }, (_, g) => chars.slice(g * size, g * size + size).join('')).join('-')
}

export function normalizeRecoveryCode(value) {
  const clean = (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return clean.match(/.{1,4}/g)?.join('-') || ''
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

export const STRENGTH_LABELS = ['Très faible', 'Faible', 'Correct', 'Solide', 'Excellent']

/** URL éphémère créée à partir d'octets déchiffrés (jamais persistée). */
export function ephemeralUrl(bytes, mime) {
  return URL.createObjectURL(new Blob([bytes], { type: mime || 'application/octet-stream' }))
}
