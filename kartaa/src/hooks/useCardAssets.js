import { useEffect, useState } from 'react'
import { qrDataUrl } from '../lib/qr'
import { publicUrl } from '../lib/slug'

/**
 * Images et QR Code d'une carte.
 * Les images sont des URL publiques servies par Supabase Storage : rien à résoudre,
 * seul le QR Code est calculé dans le navigateur.
 */
export function useCardAssets(card) {
  const photoUrl = card?.profile?.photoUrl || null
  const logoUrl = card?.companies?.[0]?.logoUrl || null
  const slug = card?.slug || ''
  const qr = useQrCode(slug ? publicUrl(slug) : null)
  return { photoUrl, logoUrl, qr }
}

/** QR Code générique (carte, coffre, lien de partage…). */
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
