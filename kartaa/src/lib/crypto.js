/**
 * Primitives de sécurité du Coffre Sécurité.
 *
 * Modèle :
 *  - chaque coffre possède une clé AES-256-GCM aléatoire (la « clé du coffre ») ;
 *  - cette clé n'est jamais stockée en clair : elle est chiffrée (wrappée) par une
 *    clé dérivée du mot de passe (PBKDF2-SHA256) et, séparément, par une clé dérivée
 *    du code de récupération ;
 *  - les fichiers sont chiffrés avec la clé du coffre avant d'être écrits sur disque ;
 *  - le mot de passe et le code de récupération ne sont jamais stockés, même hachés
 *    de façon réversible : une mauvaise saisie se traduit par un échec de déchiffrement.
 */

const enc = new TextEncoder()
const dec = new TextDecoder()

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

export function randomId(prefix = '') {
  const raw = toBase64(randomBytes(9)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)
  return prefix ? `${prefix}_${raw}` : raw
}

/* ------------------------------------------------------------------ dérive */

async function importPassphrase(passphrase) {
  return crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveBits', 'deriveKey'])
}

/** Dérive une clé AES-GCM à partir d'un secret texte (mot de passe, code de récupération). */
export async function deriveKey(passphrase, salt, iterations = KDF_ITERATIONS) {
  const material = await importPassphrase(passphrase)
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt instanceof Uint8Array ? salt : fromBase64(salt), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Hachage lent d'un mot de passe de compte (stocké côté « serveur » du prototype). */
export async function hashPassword(password, saltB64 = toBase64(randomBytes(16))) {
  const material = await importPassphrase(password)
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromBase64(saltB64), iterations: KDF_ITERATIONS, hash: 'SHA-256' },
    material,
    256,
  )
  return { salt: saltB64, hash: toBase64(bits), iterations: KDF_ITERATIONS }
}

export async function verifyPassword(password, record) {
  if (!record?.salt) return false
  const { hash } = await hashPassword(password, record.salt)
  return timingSafeEqual(hash, record.hash)
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/* -------------------------------------------------------------- chiffrement */

/** Chiffre un ArrayBuffer/Uint8Array avec une clé AES-GCM. */
export async function encryptBytes(key, bytes) {
  const iv = randomBytes(12)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes)
  return { iv: toBase64(iv), data: cipher }
}

export async function decryptBytes(key, ivB64, cipher) {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(ivB64) }, key, cipher)
}

export async function encryptJson(key, value) {
  const { iv, data } = await encryptBytes(key, enc.encode(JSON.stringify(value)))
  return { iv, data: toBase64(data) }
}

export async function decryptJson(key, ivB64, dataB64) {
  const plain = await decryptBytes(key, ivB64, fromBase64(dataB64))
  return JSON.parse(dec.decode(plain))
}

/* --------------------------------------------------------- clé de coffre */

export async function generateVaultKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function exportKeyRaw(key) {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key))
}

export async function importKeyRaw(raw) {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
}

/** Chiffre la clé du coffre avec une clé dérivée d'un secret. */
export async function wrapVaultKey(vaultKey, passphrase, saltB64) {
  const wrappingKey = await deriveKey(passphrase, saltB64)
  const raw = await exportKeyRaw(vaultKey)
  const { iv, data } = await encryptBytes(wrappingKey, raw)
  return { iv, data: toBase64(data), salt: saltB64, iterations: KDF_ITERATIONS }
}

/** Déchiffre la clé du coffre. Lève une erreur si le secret est faux. */
export async function unwrapVaultKey(wrapped, passphrase) {
  const wrappingKey = await deriveKey(passphrase, wrapped.salt, wrapped.iterations || KDF_ITERATIONS)
  const raw = await decryptBytes(wrappingKey, wrapped.iv, fromBase64(wrapped.data))
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
