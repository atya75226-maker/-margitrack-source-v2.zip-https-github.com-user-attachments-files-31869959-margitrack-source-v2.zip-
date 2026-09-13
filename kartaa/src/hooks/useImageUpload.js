import { blobs } from '../lib/storage'
import { randomId } from '../lib/crypto'

/**
 * Redimensionne une image côté navigateur puis l'enregistre dans le stockage local.
 * Évite de conserver des fichiers de 5 Mo pour une photo de profil.
 */
export async function storeImage(file, { maxSize = 1024, quality = 0.86 } = {}) {
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
  const id = randomId('img')
  await blobs.put(id, { mime: 'image/jpeg', data: await blob.arrayBuffer() })
  return { id, size: blob.size, width, height }
}

export async function imageToDataUrl(blobId) {
  const record = await blobs.get(blobId)
  if (!record) return null
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(new Blob([record.data], { type: record.mime }))
  })
}
