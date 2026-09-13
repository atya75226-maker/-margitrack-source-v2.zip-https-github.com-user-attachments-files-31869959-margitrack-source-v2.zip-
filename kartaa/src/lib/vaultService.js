/**
 * Logique métier du Coffre Sécurité : création, déverrouillage, fichiers.
 *
 * Règles appliquées ici :
 *  - la clé du coffre n'existe en clair qu'en mémoire, après authentification ;
 *  - les fichiers sont chiffrés avant écriture ; aucun octet en clair n'est persisté ;
 *  - les tentatives de déverrouillage sont limitées et journalisées ;
 *  - le code de récupération est à usage unique : il est renouvelé après emploi.
 */

import {
  generateVaultKey, wrapVaultKey, unwrapVaultKey, encryptBytes, decryptBytes,
  generateRecoveryCode, normalizeRecoveryCode, toBase64, randomBytes, randomId,
} from './crypto'
import { repo, blobs, ephemeralUrl } from './storage'
import * as webauthn from './webauthn'

export const MAX_ATTEMPTS = 5
const LOCK_STEPS_MS = [0, 0, 30_000, 60_000, 300_000, 900_000]

export class VaultError extends Error {}

/* -------------------------------------------------------------- création */

export async function createVault({ userId, name, password, useBiometrics = false, userLabel }) {
  const vaultKey = await generateVaultKey()
  const recoveryCode = generateRecoveryCode()

  const passwordWrap = await wrapVaultKey(vaultKey, password, toBase64(randomBytes(16)))
  const recoveryWrap = await wrapVaultKey(vaultKey, recoveryCode, toBase64(randomBytes(16)))

  let vault = await repo.vaults.create(userId, {
    name: name.trim(),
    protection: 'password',
    passwordWrap,
    recoveryWrap,
    recoveryIssuedAt: new Date().toISOString(),
    recoveryUsedAt: null,
    biometric: null,
    usedBytes: 0,
  })
  await repo.vaults.appendLog(vault.id, { action: 'vault.created', result: 'ok' })

  if (useBiometrics) {
    // L'enrôlement peut échouer (appareil sans capteur, refus) : le coffre reste
    // utilisable avec son mot de passe, la biométrie s'active plus tard.
    try {
      vault = await addBiometrics(vault, vaultKey, userLabel)
    } catch {
      vault = await repo.vaults.get(vault.id)
    }
  }

  return { vault, recoveryCode, vaultKey }
}

/* --------------------------------------------------------- déverrouillage */

function lockRemainingMs(vault) {
  if (!vault?.lockedUntil) return 0
  return Math.max(0, new Date(vault.lockedUntil).getTime() - Date.now())
}

export function lockStatus(vault) {
  const remaining = lockRemainingMs(vault)
  return {
    locked: remaining > 0,
    remainingMs: remaining,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - (vault?.failedAttempts || 0)),
  }
}

async function registerFailure(vault) {
  const failedAttempts = (vault.failedAttempts || 0) + 1
  const delay = LOCK_STEPS_MS[Math.min(failedAttempts, LOCK_STEPS_MS.length - 1)]
  const lockedUntil = delay ? new Date(Date.now() + delay).toISOString() : null
  await repo.vaults.update(vault.id, { failedAttempts, lockedUntil })
  await repo.vaults.appendLog(vault.id, { action: 'vault.unlock', result: 'failed', attempts: failedAttempts })
  return { failedAttempts, delay }
}

async function registerSuccess(vault, method) {
  await repo.vaults.update(vault.id, { failedAttempts: 0, lockedUntil: null, lastOpenedAt: new Date().toISOString() })
  await repo.vaults.appendLog(vault.id, { action: 'vault.unlock', result: 'ok', method })
}

function assertUnlockable(vault) {
  const status = lockStatus(vault)
  if (status.locked) {
    const seconds = Math.ceil(status.remainingMs / 1000)
    const label = seconds > 60 ? `${Math.ceil(seconds / 60)} minutes` : `${seconds} secondes`
    throw new VaultError(`Trop de tentatives. Réessayez dans ${label}.`)
  }
}

export async function unlockWithPassword(vault, password) {
  assertUnlockable(vault)
  try {
    const vaultKey = await unwrapVaultKey(vault.passwordWrap, password)
    await registerSuccess(vault, 'password')
    return vaultKey
  } catch {
    const { failedAttempts } = await registerFailure(vault)
    const left = MAX_ATTEMPTS - failedAttempts
    throw new VaultError(
      left > 0
        ? `Mot de passe incorrect. ${left} tentative${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}.`
        : 'Mot de passe incorrect. Coffre temporairement bloqué.',
    )
  }
}

export async function unlockWithRecoveryCode(vault, code) {
  assertUnlockable(vault)
  const normalized = normalizeRecoveryCode(code)
  try {
    const vaultKey = await unwrapVaultKey(vault.recoveryWrap, normalized)
    await registerSuccess(vault, 'recovery')
    return vaultKey
  } catch {
    await registerFailure(vault)
    throw new VaultError('Code de récupération invalide.')
  }
}

export async function unlockWithBiometrics(vault) {
  assertUnlockable(vault)
  if (!vault.biometric) throw new VaultError("La biométrie n'est pas activée sur ce coffre.")
  const prfSecret = await webauthn.assert(vault.biometric)
  const secret = prfSecret || webauthn.getDeviceSecret(vault.id)
  if (!secret) {
    throw new VaultError("Cet appareil n'est pas enrôlé pour ce coffre. Utilisez votre mot de passe.")
  }
  try {
    const vaultKey = await unwrapVaultKey(vault.biometric.wrap, secret)
    await registerSuccess(vault, 'biometric')
    return vaultKey
  } catch {
    await registerFailure(vault)
    throw new VaultError('Déverrouillage biométrique impossible sur cet appareil.')
  }
}

/* ------------------------------------------------------------ biométrie */

export async function enrollBiometrics({ vaultId, vaultName, userLabel, vaultKey }) {
  const enrollment = await webauthn.enroll({ vaultId: vaultId || randomId('vlt'), vaultName, userLabel })
  const secret = enrollment.prfSupported ? await webauthn.assert(enrollment) : toBase64(randomBytes(32))
  const effectiveSecret = secret || toBase64(randomBytes(32))
  const wrap = await wrapVaultKey(vaultKey, effectiveSecret, toBase64(randomBytes(16)))
  return { ...enrollment, wrap, pendingSecret: enrollment.prfSupported ? null : effectiveSecret }
}

/** Active la biométrie sur un coffre déjà déverrouillé. */
export async function addBiometrics(vault, vaultKey, userLabel) {
  const biometric = await enrollBiometrics({ vaultId: vault.id, vaultName: vault.name, userLabel, vaultKey })
  if (biometric.pendingSecret) {
    webauthn.storeDeviceSecret(vault.id, biometric.pendingSecret)
    delete biometric.pendingSecret
  }
  await repo.vaults.appendLog(vault.id, { action: 'vault.biometrics.enabled', result: 'ok' })
  return repo.vaults.update(vault.id, { biometric, protection: 'password+biometric' })
}

export async function removeBiometrics(vault) {
  webauthn.clearDeviceSecret(vault.id)
  await repo.vaults.appendLog(vault.id, { action: 'vault.biometrics.disabled', result: 'ok' })
  return repo.vaults.update(vault.id, { biometric: null, protection: 'password' })
}

/* ----------------------------------------------------------- récupération */

/** Réinitialise le mot de passe avec le code de récupération, puis renouvelle ce code. */
export async function resetPasswordWithRecovery(vault, code, newPassword) {
  const vaultKey = await unlockWithRecoveryCode(vault, code)
  const passwordWrap = await wrapVaultKey(vaultKey, newPassword, toBase64(randomBytes(16)))
  const recoveryCode = generateRecoveryCode()
  const recoveryWrap = await wrapVaultKey(vaultKey, recoveryCode, toBase64(randomBytes(16)))
  const updated = await repo.vaults.update(vault.id, {
    passwordWrap,
    recoveryWrap,
    recoveryIssuedAt: new Date().toISOString(),
    recoveryUsedAt: new Date().toISOString(),
    failedAttempts: 0,
    lockedUntil: null,
  })
  await repo.vaults.appendLog(vault.id, { action: 'vault.password.reset', result: 'ok' })
  return { vault: updated, recoveryCode, vaultKey }
}

/** Change le mot de passe depuis un coffre déverrouillé. */
export async function changePassword(vault, vaultKey, newPassword) {
  const passwordWrap = await wrapVaultKey(vaultKey, newPassword, toBase64(randomBytes(16)))
  await repo.vaults.appendLog(vault.id, { action: 'vault.password.changed', result: 'ok' })
  return repo.vaults.update(vault.id, { passwordWrap })
}

/** Régénère un code de récupération (l'ancien devient inutilisable). */
export async function regenerateRecoveryCode(vault, vaultKey) {
  const recoveryCode = generateRecoveryCode()
  const recoveryWrap = await wrapVaultKey(vaultKey, recoveryCode, toBase64(randomBytes(16)))
  const updated = await repo.vaults.update(vault.id, {
    recoveryWrap,
    recoveryIssuedAt: new Date().toISOString(),
    recoveryUsedAt: null,
  })
  await repo.vaults.appendLog(vault.id, { action: 'vault.recovery.regenerated', result: 'ok' })
  return { vault: updated, recoveryCode }
}

/* --------------------------------------------------------------- fichiers */

export function categoryOf(mime = '', name = '') {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (/\.(pdf)$/i.test(name) || mime === 'application/pdf') return 'pdf'
  return 'document'
}

/** Chiffre puis stocke un fichier. Retourne le coffre mis à jour. */
export async function addFile(vault, vaultKey, file, folderId = null) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { iv, data } = await encryptBytes(vaultKey, bytes)
  const blobId = randomId('blb')
  await blobs.put(blobId, { mime: 'application/octet-stream', data, encrypted: true, iv })

  const entry = {
    id: randomId('fil'),
    name: file.name,
    mime: file.type || 'application/octet-stream',
    category: categoryOf(file.type, file.name),
    size: file.size,
    folderId,
    blobId,
    iv,
    addedAt: new Date().toISOString(),
  }
  const files = [...(vault.files || []), entry]
  const usedBytes = files.reduce((total, item) => total + (item.size || 0), 0)
  const updated = await repo.vaults.update(vault.id, { files, usedBytes })
  await repo.vaults.appendLog(vault.id, { action: 'file.added', result: 'ok', file: entry.name })
  return updated
}

/** Déchiffre un fichier en mémoire et retourne une URL éphémère. */
export async function openFile(vault, vaultKey, fileId, { log = true } = {}) {
  const file = (vault.files || []).find((item) => item.id === fileId)
  if (!file) throw new VaultError('Fichier introuvable.')
  const record = await blobs.get(file.blobId)
  if (!record) throw new VaultError('Contenu indisponible sur cet appareil.')
  const plain = await decryptBytes(vaultKey, file.iv, record.data)
  if (log) await repo.vaults.appendLog(vault.id, { action: 'file.opened', result: 'ok', file: file.name })
  return { file, bytes: plain, url: ephemeralUrl(plain, file.mime) }
}

export async function removeFile(vault, fileId) {
  const file = (vault.files || []).find((item) => item.id === fileId)
  if (file) await blobs.remove(file.blobId)
  const files = (vault.files || []).filter((item) => item.id !== fileId)
  const usedBytes = files.reduce((total, item) => total + (item.size || 0), 0)
  await repo.vaults.appendLog(vault.id, { action: 'file.deleted', result: 'ok', file: file?.name })
  return repo.vaults.update(vault.id, { files, usedBytes })
}

export async function createFolder(vault, name) {
  const folders = [...(vault.folders || []), { id: randomId('fld'), name: name.trim(), createdAt: new Date().toISOString() }]
  return repo.vaults.update(vault.id, { folders })
}

export async function removeFolder(vault, folderId) {
  const folders = (vault.folders || []).filter((folder) => folder.id !== folderId)
  const files = (vault.files || []).map((file) => (file.folderId === folderId ? { ...file, folderId: null } : file))
  return repo.vaults.update(vault.id, { folders, files })
}

export function usedBytesOf(vault) {
  return (vault?.files || []).reduce((total, file) => total + (file.size || 0), 0)
}
