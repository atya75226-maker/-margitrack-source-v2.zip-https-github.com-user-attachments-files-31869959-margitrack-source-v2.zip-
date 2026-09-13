import { useEffect, useState } from 'react'
import { objectUrl } from '../lib/storage'
import { qrDataUrl } from '../lib/qr'
import { publicUrl } from '../lib/slug'

/** Résout les images locales et le QR Code d'une carte. */
export function useCardAssets(card) {
  const [assets, setAssets] = useState({ photoUrl: null, logoUrl: null, qr: null })

  const photoId = card?.profile?.photoId || null
  const logoId = card?.companies?.[0]?.logoId || null
  const slug = card?.slug || ''
  const dark = card?.theme?.primary && card.template !== 'premium' ? '#141728' : '#141728'

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [photoUrl, logoUrl, qr] = await Promise.all([
        photoId ? objectUrl(photoId) : null,
        logoId ? objectUrl(logoId) : null,
        slug ? qrDataUrl(publicUrl(slug), { dark }) : null,
      ])
      if (!cancelled) setAssets({ photoUrl, logoUrl, qr })
    }
    load()
    return () => {
      cancelled = true
    }
  }, [photoId, logoId, slug, dark])

  return assets
}

export function useBlobUrl(blobId) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let cancelled = false
    if (!blobId) {
      setUrl(null)
      return undefined
    }
    objectUrl(blobId).then((value) => {
      if (!cancelled) setUrl(value)
    })
    return () => {
      cancelled = true
    }
  }, [blobId])
  return url
}

/** QR Code générique (coffre, lien de partage…). */
export function useQrCode(value, options) {
  const [qr, setQr] = useState(null)
  const serialized = JSON.stringify(options || {})
  useEffect(() => {
    let cancelled = false
    if (!value) {
      setQr(null)
      return undefined
    }
    qrDataUrl(value, JSON.parse(serialized)).then((data) => {
      if (!cancelled) setQr(data)
    })
    return () => {
      cancelled = true
    }
  }, [value, serialized])
  return qr
}
