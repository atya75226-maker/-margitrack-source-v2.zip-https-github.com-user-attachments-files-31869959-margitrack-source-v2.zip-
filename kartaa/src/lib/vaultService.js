/**
 * Logique métier du Coffre Sécurité, côté client.
 *
 * Ce que le serveur voit, et ce qu'il ne voit pas :
 *  - il reçoit la clé du coffre **déjà chiffrée** et un « vérificateur » dont il ne
 *    conserve que l'empreinte SHA-256 ; ni le mot de passe, ni le code de
 *    récupération, ni la clé en clair ne quittent le navigateur ;
 *  - c'est lui, en revanche, qui compte les tentatives et refuse de livrer la clé
 *    chiffrée tant que le vérificateur ne correspond pas : impossible de forcer un
 *    coffre hors ligne en récupérant la base ;
 *  - les fichiers sont chiffrés avant téléversement et servis par URL signée de
 *    courte durée.
 */

import {
  generateVaultKey, wrapVaultKey, openWrappedKey, deriveVaultMaterial,
  encryptBytes, decryptBytes, generateRecoveryCode, normalizeRecoveryCode,
  toBase64, randomBytes, ephemeralUrl, KDF_ITERATIONS,
} from './crypto'
import { supabase, readableError } from './supabaseClient'
import * as vaultPublic from './vaultPublic'
import { repo, notifyChange } from './storage'
import * as webauthn from './webauthn'

export const MAX_ATTEMPTS = 5

export class VaultError extends Error {}

/* ------------------------------------------------------------------ erreurs */

async function rpc(name, params, fallback) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw new VaultError(readableError(error, fallback))
  return data
}

function delayLabel(seconds = 0) {
  return seconds > 60 ? `${Math.ceil(seconds / 60)} minutes` : `${Math.max(1, seconds)} secondes`
}

/**
 * Le serveur répond par un statut plutôt qu'une erreur : c'est ce qui permet au
 * comptage des tentatives d'être validé en base même quand l'essai échoue.
 */
function statusError(status) {
  switch (status?.error) {
    case 'locked':
      return new VaultError(`Trop de tentatives. Réessayez dans ${delayLabel(status.retryInSeconds)}.`)
    case 'password': {
      const left = status.attemptsLeft ?? 0
      return new VaultError(
        left > 0
          ? `Mot de passe incorrect. ${left} tentative${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}.`
          : 'Mot de passe incorrect. Coffre temporairement bloqué.',
      )
    }
    case 'recovery':
      return new VaultError('Code de récupération invalide.')
    case 'not_found':
      return new VaultError('Ce coffre n\'existe plus.')
    case 'session':
      return new VaultError('Session du coffre expirée. Saisissez à nouveau le mot de passe.')
    case 'biometric_disabled':
      return new VaultError("La biométrie n'est pas activée sur ce coffre.")
    case 'biometric':
      return new VaultError(
        "Cet appareil n'est pas reconnu pour ce coffre. Ouvrez-le avec votre mot de passe, puis activez la biométrie depuis la page du coffre.",
      )
    default:
      return new VaultError('Coffre inaccessible.')
  }
}

/**
 * Appelle une fonction d'ouverture et renvoie son statut complet : la clé
 * chiffrée et, depuis l'ouverture sans compte, le jeton de session qui
 * autorisera la lecture des fichiers.
 */
async function openStatus(name, params, fallback) {
  const status = await rpc(name, params, fallback)
  if (!status?.ok) throw statusError(status)
  return status
}

/* -------------------------------------------------------------- création */

export async function createVault({ name, password, useBiometrics = false, userLabel }) {
  const vaultKey = await generateVaultKey()
  const recoveryCode = generateRecoveryCode()

  const password_ = await wrapVaultKey(vaultKey, password)
  const recovery_ = await wrapVaultKey(vaultKey, recoveryCode)

  const vaultId = await rpc('vault_create', {
    p_name: name.trim(),
    p_kdf_iterations: KDF_ITERATIONS,
    p_password_salt: password_.salt,
    p_password_verifier: password_.verifier,
    p_password_wrap: password_.wrap,
    p_recovery_salt: recovery_.salt,
    p_recovery_verifier: recovery_.verifier,
    p_recovery_wrap: recovery_.wrap,
  }, "Le coffre n'a pas pu être créé.")

  let vault = await repo.vaults.get(vaultId)

  // Un refus du capteur ne doit pas faire échouer la création : le mot de passe
  // suffit, la biométrie s'ajoute plus tard. En revanche l'échec est remonté —
  // le taire laissait croire à un coffre protégé par l'empreinte alors qu'il ne
  // l'était pas.
  let biometricError = null
  if (useBiometrics) {
    try {
      vault = await addBiometrics(vault, vaultKey, userLabel)
    } catch (error) {
      biometricError = error?.message || "L'enrôlement biométrique n'a pas abouti."
      vault = await repo.vaults.get(vaultId)
    }
  }

  notifyChange()
  return { vault, recoveryCode, vaultKey, biometricError }
}

/* --------------------------------------------------------- déverrouillage */

export function lockStatus(vault) {
  const remaining = vault?.lockedUntil ? Math.max(0, new Date(vault.lockedUntil).getTime() - Date.now()) : 0
  return {
    locked: remaining > 0,
    remainingMs: remaining,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - (vault?.failedAttempts || 0)),
  }
}

async function intro(vaultId) {
  const info = await vaultPublic.intro(vaultId)
  if (!info) throw new VaultError('Coffre introuvable.')
  return info
}

export async function unlockWithPassword(vault, password) {
  const info = await intro(vault.id)
  const { wrappingKey, verifier } = await deriveVaultMaterial(password, info.passwordSalt, info.kdfIterations)
  const status = await openStatus('vault_open', { p_vault_id: vault.id, p_verifier: verifier }, 'Ouverture impossible.')
  try {
    return { key: await openWrappedKey(status.wrap, wrappingKey), token: status.token }
  } catch {
    throw new VaultError("La clé du coffre n'a pas pu être déchiffrée.")
  }
}

export async function unlockWithRecoveryCode(vault, code) {
  const info = await intro(vault.id)
  const normalized = normalizeRecoveryCode(code)
  const { wrappingKey, verifier } = await deriveVaultMaterial(normalized, info.recoverySalt, info.kdfIterations)
  const status = await openStatus('vault_open_recovery', { p_vault_id: vault.id, p_verifier: verifier }, 'Ouverture impossible.')
  try {
    return { key: await openWrappedKey(status.wrap, wrappingKey), token: status.token }
  } catch {
    throw new VaultError('Code de récupération invalide.')
  }
}

/**
 * Déverrouillage par empreinte ou visage.
 *
 * Le capteur reste géré par le téléphone : il ne rend qu'une signature, dont on
 * tire un secret propre à cet appareil. De ce secret le navigateur dérive une
 * preuve, exactement comme il le ferait d'un mot de passe, et le serveur ne
 * livre l'enveloppe chiffrée que si cette preuve correspond. Aucun compte n'est
 * nécessaire : détenir l'appareil enrôlé est la preuve.
 */
export async function unlockWithBiometrics(vault) {
  const info = await intro(vault.id)
  if (!info.biometric) throw new VaultError("La biométrie n'est pas activée sur ce coffre.")

  const prfSecret = await webauthn.assert(info.biometric)
  const secret = prfSecret || webauthn.getDeviceSecret(vault.id)
  if (!secret) {
    throw new VaultError("Cet appareil n'est pas enrôlé pour ce coffre. Utilisez votre mot de passe.")
  }

  const tours = info.biometricIterations || KDF_ITERATIONS
  // Les enrôlements antérieurs à la preuve par vérificateur n'ont pas de sel
  // publié : le serveur s'en tient alors à l'ancienne règle du propriétaire.
  const derive = info.biometricSalt ? await deriveVaultMaterial(secret, info.biometricSalt, tours) : null

  const status = await openStatus(
    'vault_open_biometric',
    { p_vault_id: vault.id, p_verifier: derive?.verifier ?? null },
    'Déverrouillage biométrique impossible.',
  )

  const wrap = status.wrap
  try {
    // La dérivation coûte deux cent mille tours : on ne la refait que si le sel
    // renvoyé diffère de celui qui a servi à la preuve.
    const { wrappingKey } = derive && info.biometricSalt === wrap.salt
      ? derive
      : await deriveVaultMaterial(secret, wrap.salt, wrap.iterations || KDF_ITERATIONS)
    return { key: await openWrappedKey(wrap, wrappingKey), token: status.token || null }
  } catch {
    throw new VaultError('Déverrouillage biométrique impossible sur cet appareil.')
  }
}

/* ------------------------------------------------------------ biométrie */

export async function addBiometrics(vault, vaultKey, userLabel) {
  const enrollment = await webauthn.enroll({ vaultId: vault.id, vaultName: vault.name, userLabel })
  const secret = (enrollment.prfSupported ? await webauthn.assert(enrollment) : null) || toBase64(randomBytes(32))
  const wrapped = await wrapVaultKey(vaultKey, secret)

  if (!enrollment.prfSupported) webauthn.storeDeviceSecret(vault.id, secret)

  await rpc('vault_set_biometric', {
    p_vault_id: vault.id,
    p_biometric: { credentialId: enrollment.credentialId, prfSalt: enrollment.prfSalt, prfSupported: enrollment.prfSupported, enrolledAt: enrollment.enrolledAt },
    p_wrap: wrapped.wrap,
    // Le vérificateur permettra au serveur d'exiger une preuve au déverrouillage,
    // au lieu de se fier au compte connecté : le QR Code n'en ouvre aucun.
    p_verifier: wrapped.verifier,
  }, "L'enrôlement biométrique a échoué.")

  notifyChange()
  return repo.vaults.get(vault.id)
}

export async function removeBiometrics(vault) {
  webauthn.clearDeviceSecret(vault.id)
  await rpc('vault_set_biometric', { p_vault_id: vault.id, p_biometric: null, p_wrap: null, p_verifier: null }, 'Désactivation impossible.')
  notifyChange()
  return repo.vaults.get(vault.id)
}

/* ----------------------------------------------------------- récupération */

/** Réinitialise le mot de passe avec le code de récupération, puis renouvelle ce code. */
export async function resetPasswordWithRecovery(vault, code, newPassword) {
  const info = await intro(vault.id)
  const normalized = normalizeRecoveryCode(code)
  const { wrappingKey, verifier } = await deriveVaultMaterial(normalized, info.recoverySalt, info.kdfIterations)

  // On récupère d'abord la clé du coffre : sans elle, impossible de la ré-envelopper.
  const ouverture = await openStatus('vault_open_recovery', { p_vault_id: vault.id, p_verifier: verifier }, 'Ouverture impossible.')
  let vaultKey
  try {
    vaultKey = await openWrappedKey(ouverture.wrap, wrappingKey)
  } catch {
    throw new VaultError('Code de récupération invalide.')
  }

  const recoveryCode = generateRecoveryCode()
  const password_ = await wrapVaultKey(vaultKey, newPassword)
  const recovery_ = await wrapVaultKey(vaultKey, recoveryCode)

  const status = await rpc('vault_reset_password', {
    p_vault_id: vault.id,
    p_recovery_verifier: verifier,
    p_password_salt: password_.salt,
    p_password_verifier: password_.verifier,
    p_password_wrap: password_.wrap,
    p_new_recovery_salt: recovery_.salt,
    p_new_recovery_verifier: recovery_.verifier,
    p_new_recovery_wrap: recovery_.wrap,
  }, 'Réinitialisation impossible.')
  if (!status?.ok) throw statusError(status)

  notifyChange()
  // Le coffre n'est rechargé depuis la table que pour son propriétaire : un
  // visiteur venu par le QR Code n'y a pas accès, et n'en a pas besoin — le
  // jeton fraîchement émis lui ouvre le contenu.
  const rafraichi = info.isOwner ? await repo.vaults.get(vault.id) : null
  return { vault: rafraichi, recoveryCode, vaultKey, token: status.token }
}

/** Change le mot de passe depuis un coffre déverrouillé. */
export async function changePassword(vault, vaultKey, newPassword) {
  const wrapped = await wrapVaultKey(vaultKey, newPassword)
  await rpc('vault_set_password', {
    p_vault_id: vault.id,
    p_salt: wrapped.salt,
    p_verifier: wrapped.verifier,
    p_wrap: wrapped.wrap,
  }, 'Changement de mot de passe impossible.')
  notifyChange()
  return repo.vaults.get(vault.id)
}

/** Régénère un code de récupération : l'ancien cesse immédiatement de fonctionner. */
export async function regenerateRecoveryCode(vault, vaultKey) {
  const recoveryCode = generateRecoveryCode()
  const wrapped = await wrapVaultKey(vaultKey, recoveryCode)
  await rpc('vault_set_recovery', {
    p_vault_id: vault.id,
    p_salt: wrapped.salt,
    p_verifier: wrapped.verifier,
    p_wrap: wrapped.wrap,
  }, 'Renouvellement impossible.')
  notifyChange()
  return { vault: await repo.vaults.get(vault.id), recoveryCode }
}

/* --------------------------------------------------------------- fichiers */

const BUCKET = 'vault-files'

export function categoryOf(mime = '', name = '') {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (/\.(pdf)$/i.test(name) || mime === 'application/pdf') return 'pdf'
  return 'document'
}

/** Chiffre le fichier dans le navigateur, puis téléverse le résultat chiffré. */
export async function addFile(vault, vaultKey, file, folderId = null) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { iv, data } = await encryptBytes(vaultKey, bytes)

  const storagePath = `${vault.userId}/${vault.id}/${crypto.randomUUID()}`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, new Blob([data], { type: 'application/octet-stream' }), {
      contentType: 'application/octet-stream',
      upsert: false,
    })
  if (uploadError) throw new VaultError(readableError(uploadError, "Le fichier n'a pas pu être envoyé."))

  const { error } = await supabase.from('vault_files').insert({
    vault_id: vault.id,
    name: file.name,
    mime: file.type || 'application/octet-stream',
    category: categoryOf(file.type, file.name),
    size: file.size,
    folder_id: folderId,
    storage_path: storagePath,
    iv,
  })
  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw new VaultError(readableError(error, "Le fichier n'a pas pu être enregistré."))
  }

  await repo.vaults.appendLog(vault.id, { action: 'file.added', result: 'ok', file: file.name })
  notifyChange()
  return repo.vaults.get(vault.id)
}

/**
 * Télécharge le fichier chiffré par URL signée, puis le déchiffre en mémoire.
 *
 * Deux chemins, selon qui regarde :
 *  - le propriétaire connecté signe l'URL lui-même, les règles du bucket le
 *    reconnaissent ;
 *  - une personne venue par le QR Code n'a pas de compte : elle présente son
 *    jeton de session à la fonction Edge, qui revérifie puis signe.
 *
 * Dans les deux cas le bucket reste privé, l'URL expire en une minute, et le
 * déchiffrement a lieu ici, dans le navigateur, avec la clé dérivée du mot de
 * passe. Le serveur ne voit jamais le contenu en clair.
 */
export async function openFile(vault, vaultKey, fileId, { log = true, token = null } = {}) {
  const file = (vault.files || []).find((item) => item.id === fileId)
  if (!file) throw new VaultError('Fichier introuvable.')

  let url = null
  let iv = file.iv

  if (file.storagePath) {
    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(file.storagePath, 60)
    if (error || !signed?.signedUrl) throw new VaultError('Contenu indisponible.')
    url = signed.signedUrl
  } else {
    if (!token) throw new VaultError('Session du coffre expirée. Saisissez à nouveau le mot de passe.')
    const signee = await vaultPublic.signedFileUrl(token, fileId)
    url = signee.url
    iv = signee.iv || iv
  }

  const response = await fetch(url)
  if (!response.ok) throw new VaultError('Contenu indisponible.')
  const cipher = await response.arrayBuffer()

  let plain
  try {
    plain = await decryptBytes(vaultKey, iv, cipher)
  } catch {
    throw new VaultError('Ce fichier ne peut pas être déchiffré avec cette clé.')
  }

  // Le journal du coffre n'est écrit ici que pour le propriétaire ; pour un
  // visiteur, c'est vault_session_file() qui l'a déjà fait côté serveur.
  if (log && file.storagePath) {
    await repo.vaults.appendLog(vault.id, { action: 'file.opened', result: 'ok', file: file.name })
  }
  return { file, bytes: plain, url: ephemeralUrl(plain, file.mime) }
}

export async function removeFile(vault, fileId) {
  const file = (vault.files || []).find((item) => item.id === fileId)
  if (file) {
    await supabase.storage.from(BUCKET).remove([file.storagePath])
    await supabase.from('vault_files').delete().eq('id', fileId)
    await repo.vaults.appendLog(vault.id, { action: 'file.deleted', result: 'ok', file: file.name })
  }
  notifyChange()
  return repo.vaults.get(vault.id)
}

/* ---------------------------------------------------------------- dossiers */

export async function createFolder(vault, name) {
  const folders = [...(vault.folders || []), { id: crypto.randomUUID(), name: name.trim(), createdAt: new Date().toISOString() }]
  return repo.vaults.update(vault.id, { folders })
}

export async function removeFolder(vault, folderId) {
  const folders = (vault.folders || []).filter((folder) => folder.id !== folderId)
  await supabase.from('vault_files').update({ folder_id: null }).eq('vault_id', vault.id).eq('folder_id', folderId)
  return repo.vaults.update(vault.id, { folders })
}

export function usedBytesOf(vault) {
  return (vault?.files || []).reduce((total, file) => total + (file.size || 0), 0)
}
