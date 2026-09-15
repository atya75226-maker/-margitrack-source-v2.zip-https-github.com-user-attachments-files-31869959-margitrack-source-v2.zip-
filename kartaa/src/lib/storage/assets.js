/**
 * Images publiques des cartes (photo de profil, logos, photos de services).
 *
 * Elles sont volontairement dans un espace public : elles s'affichent sur le
 * mini-site, que le visiteur soit connecté ou non. Les fichiers privés, eux, ne
 * passent jamais par ici — voir vaultService.
 */

import { supabase, readableError } from '../supabaseClient'
import { randomId } from '../crypto'

const BUCKET = 'card-assets'

/** Redimensionne l'image dans le navigateur puis la téléverse. */
export async function uploadImage(file, { maxSize = 1024, quality = 0.86 } = {}) {
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth?.user?.id
  if (!userId) throw new Error('Authentification requise.')

  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * ratio)
  const height = Math.round(bitmap.height * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  const path = `${userId}/${randomId()}.jpg`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) throw new Error(readableError(error, "L'image n'a pas pu être envoyée."))

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { path, url: data.publicUrl, size: blob.size }
}

/**
 * Retrouve le chemin d'une image de notre espace public à partir de son URL.
 *
 * Sert à supprimer l'ancien fichier quand on en téléverse un nouveau : sans
 * lui, chaque changement de photo laisserait un fichier orphelin. Une image
 * hébergée ailleurs (la photo Google d'un compte, par exemple) ne nous
 * appartient pas : on renvoie alors null, et rien n'est supprimé.
 */
export function publicImagePath(url) {
  if (!url) return null
  const marqueur = `/storage/v1/object/public/${BUCKET}/`
  const index = url.indexOf(marqueur)
  if (index === -1) return null
  return decodeURIComponent(url.slice(index + marqueur.length).split('?')[0]) || null
}

export async function removeImage(path) {
  if (!path) return
  await supabase.storage.from(BUCKET).remove([path])
}

/** Convertit une image distante en data URL (pour l'export vCard et PDF). */
export async function toDataUrl(url) {
  if (!url) return null
  try {
    const response = await fetch(url, { mode: 'cors' })
    const blob = await response.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}
