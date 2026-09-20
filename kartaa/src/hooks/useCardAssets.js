import { useEffect, useState } from 'react'
import { qrDataUrl, qrSvgDataUrl } from '../lib/qr'
import { publicUrl } from '../lib/slug'
import { useAuth } from '../state/AuthContext'

/**
 * Images et QR Code d'une carte.
 *
 * Les images sont des URL publiques servies par Supabase Storage : rien à
 * résoudre, seul le QR Code est calculé dans le navigateur.
 *
 * Deux formes du même code sont renvoyées, parce qu'elles ne servent pas à la
 * même chose : `qr` est vectoriel — c'est celui de la carte, net à l'impression
 * quelle que soit la taille — et `qrPng` est une image matricielle, pour le
 * bouton qui télécharge le code seul en `.png`.
 *
 * La photo et le logo ne sont plus dessinés sur la carte : elle ne porte que la
 * marque et le QR Code. Ils restent renvoyés ici pour le mini-site public, qui
 * les affiche, lui.
 *
 * La photo suit une règle unique : celle choisie pour cette carte si elle
 * existe, sinon celle du compte. L'utilisateur n'a donc qu'une photo à gérer —
 * celle de son profil — et ses cartes la reprennent d'elles-mêmes. C'est ce
 * lien qui manquait : la carte ne lisait que sa propre photo, si bien qu'un
 * compte doté d'une photo affichait malgré tout ses initiales.
 *
 * `photoDuCompte` est explicite pour le mini-site public : cette page ne
 * connaît pas le compte du visiteur, elle passe la photo renvoyée par la base.
 * Sans ce garde-fou, un visiteur connecté verrait sa propre photo sur la carte
 * de quelqu'un d'autre.
 */
export function useCardAssets(card, photoDuCompte) {
  const { user } = useAuth()
  const photoProprietaire = photoDuCompte !== undefined
    ? photoDuCompte || null
    : (estSaCarte(card, user) ? user.avatarUrl || null : null)

  const photoUrl = card?.profile?.photoUrl || photoProprietaire
  // Logo et photo sont indépendants : on peut n'avoir que l'un, les deux, ou
  // aucun des deux. Celui de la carte prime ; à défaut, celui de l'entreprise
  // déjà saisie sert de logo par défaut plutôt que d'être ignoré.
  const logoUrl = card?.profile?.logoUrl || card?.companies?.[0]?.logoUrl || null
  const slug = card?.slug || ''
  const adresse = slug ? publicUrl(slug) : null
  const qr = useQrVectoriel(adresse)
  const qrPng = useQrCode(adresse)
  return { photoUrl, logoUrl, qr, qrPng }
}

/** Une carte en cours de création n'a pas encore de propriétaire : elle est déjà la sienne. */
function estSaCarte(card, user) {
  if (!user || !card) return false
  return !card.userId || card.userId === user.id
}

/** QR Code vectoriel — celui que porte la carte. */
export function useQrVectoriel(value, options) {
  const [qr, setQr] = useState(null)
  const serialized = JSON.stringify(options || {})

  useEffect(() => {
    let cancelled = false
    if (!value) {
      setQr(null)
      return undefined
    }
    qrSvgDataUrl(value, JSON.parse(serialized)).then((data) => {
      if (!cancelled) setQr(data)
    })
    return () => {
      cancelled = true
    }
  }, [value, serialized])

  return qr
}

/** QR Code matriciel générique (téléchargement du code seul, lien de partage…). */
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
