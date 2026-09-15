/**
 * Accès à un coffre sans compte utilisateur — le chemin du QR Code.
 *
 * Deux authentifications distinctes cohabitent dans Kartaa, et ce fichier tient
 * la seconde :
 *
 *   le COMPTE          donne au propriétaire la gestion de ses cartes et coffres ;
 *   le MOT DE PASSE    du coffre donne accès à son contenu, avec ou sans compte.
 *
 * Une personne qui scanne le QR Code n'a rien d'autre que l'identifiant du
 * coffre. Elle obtient les sels (publics par nature), dérive son vérificateur
 * dans son navigateur, et le serveur ne lui livre la clé chiffrée que si
 * l'empreinte correspond — en comptant les tentatives de son côté. La réussite
 * ouvre une session de coffre : un jeton de 256 bits, valable trente minutes,
 * qui sert ensuite à lister les fichiers et à obtenir leurs URL signées.
 *
 * Le serveur ne voit jamais le mot de passe, le code de récupération, ni la clé
 * en clair.
 */

import { supabase, readableError } from './supabaseClient'

/** État du coffre avant toute authentification. Jamais son nom, jamais son contenu. */
export async function intro(vaultId) {
  const { data, error } = await supabase.rpc('vault_intro', { p_vault_id: vaultId })
  if (error) throw new Error(readableError(error, 'Coffre introuvable.'))
  if (!data) return null
  return {
    id: data.id,
    isOwner: !!data.isOwner,
    // Un visiteur ne doit pas apprendre ce que contient le coffre avant d'en
    // avoir donné le mot de passe : le serveur ne renvoie le nom qu'au propriétaire.
    name: data.name || null,
    protection: data.protection,
    hasBiometric: !!data.hasBiometric,
    biometric: data.biometric || null,
    // Sels de l'enveloppe biométrique : publics par nature, comme ceux du mot
    // de passe. Ils permettent au navigateur de calculer sa preuve avant même
    // de demander quoi que ce soit au serveur.
    biometricSalt: data.biometricSalt || null,
    biometricIterations: data.biometricIterations || null,
    failedAttempts: data.failedAttempts || 0,
    lockedUntil: data.lockedUntil,
    kdfIterations: data.kdfIterations,
    passwordSalt: data.passwordSalt,
    recoverySalt: data.recoverySalt,
  }
}

/** Contenu du coffre, livré seulement contre un jeton de session valable. */
export async function contentByToken(token) {
  const { data, error } = await supabase.rpc('vault_session_content', { p_token: token })
  if (error) throw new Error(readableError(error, 'Coffre indisponible.'))
  if (!data?.ok) return null
  return {
    id: data.vault.id,
    name: data.vault.name,
    protection: data.vault.protection,
    hasBiometric: data.vault.protection === 'password+biometric',
    folders: data.vault.folders || [],
    files: (data.files || []).map((file) => ({
      id: file.id,
      vaultId: data.vault.id,
      name: file.name,
      mime: file.mime,
      category: file.category,
      size: Number(file.size) || 0,
      folderId: file.folderId,
      iv: file.iv,
      addedAt: file.addedAt,
      // Le chemin de stockage ne descend pas jusqu'au navigateur : l'URL signée
      // se demande au serveur, fichier par fichier.
      storagePath: null,
    })),
    accessLog: [],
  }
}

/**
 * URL signée d'un fichier, valable une minute, obtenue auprès de la fonction
 * Edge « vault-file » qui revérifie le jeton avant de signer quoi que ce soit.
 * Le bucket reste privé : aucune autre voie ne mène au fichier.
 */
export async function signedFileUrl(token, fileId) {
  const { data, error } = await supabase.functions.invoke('vault-file', {
    body: { token, fileId },
  })
  if (error || !data?.ok) throw new Error('Contenu indisponible.')
  return data
}

/** Referme la session de coffre côté serveur. */
export async function closeSession(token) {
  if (!token) return
  await supabase.rpc('vault_session_close', { p_token: token }).catch(() => null)
}
