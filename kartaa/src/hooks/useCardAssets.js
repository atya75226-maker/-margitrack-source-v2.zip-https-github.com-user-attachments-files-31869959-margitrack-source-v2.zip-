import { useEffect, useState } from 'react'
import { qrDataUrl } from '../lib/qr'
import { toDataUrl } from '../lib/storage'
import { publicUrl } from '../lib/slug'
import { useAuth } from '../state/AuthContext'

/**
 * Images et QR Code d'une carte.
 *
 * Les images sont des URL publiques servies par Supabase Storage : rien à
 * résoudre, seul le QR Code est calculé dans le navigateur.
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
  const qr = useQrCode(slug ? publicUrl(slug) : null)
  return { photoUrl, logoUrl, qr }
}

/** Une carte en cours de création n'a pas encore de propriétaire : elle est déjà la sienne. */
function estSaCarte(card, user) {
  if (!user || !card) return false
  return !card.userId || card.userId === user.id
}

/**
 * Même photo, mais embarquée dans la page, pour les faces rendues hors écran
 * qui servent au téléchargement.
 *
 * L'export transforme le HTML en image : s'il doit aller chercher la photo sur
 * le réseau à cet instant, un serveur lent ou un en-tête manquant produit un
 * fichier sans la photo, différent de ce que l'utilisateur voit. En la
 * convertissant à l'avance, le rendu n'a plus rien à télécharger.
 *
 * Tant que la conversion n'a pas abouti, on renvoie l'adresse d'origine :
 * l'aperçu et le fichier montrent la même image dans tous les cas.
 */
export function usePhotoEmbarquee(photoUrl) {
  const [inline, setInline] = useState(null)

  useEffect(() => {
    let cancelled = false
    setInline(null)
    if (!photoUrl || photoUrl.startsWith('data:')) return undefined
    toDataUrl(photoUrl).then((data) => {
      if (!cancelled && data) setInline(data)
    })
    return () => {
      cancelled = true
    }
  }, [photoUrl])

  return inline || photoUrl || null
}

/** QR Code générique (carte, lien de partage…). */
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
