import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Panel, Spinner } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import { repo } from '../../lib/storage'
import { chargerProfilPublic } from '../../lib/offline/donnees'
import { useCardAssets } from '../../hooks/useCardAssets'
import { downloadVCard } from '../../lib/vcard'
import { toDataUrl } from '../../lib/storage'
import { copyToClipboard } from '../../lib/download'
import { publicUrl } from '../../lib/slug'
import { useToast } from '../../state/ToastContext'
import ProfileView from './ProfileView'

/**
 * Mini-site public : la page qu'ouvre le QR Code. Pensée d'abord pour le téléphone.
 *
 * Cette page s'occupe des données — les charger, les compter, les partager — et
 * confie l'affichage à `ProfileView`, le même composant que montre la page
 * d'accueil. Ce qu'un visiteur voit ici et ce que la vitrine promet ne peuvent
 * donc pas diverger.
 */
export default function PublicProfilePage() {
  const { slug } = useParams()
  const toast = useToast()
  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(true)
  const counted = useRef(false)

  // Vrai quand la page vient de la copie enregistrée lors d'une visite
  // précédente : on l'annonce, on ne la fait pas passer pour fraîche.
  const [horsLigne, setHorsLigne] = useState(false)

  useEffect(() => {
    let cancelled = false
    chargerProfilPublic(slug).then(async ({ profil: found, local }) => {
      if (cancelled) return
      setCard(found)
      setHorsLigne(local && !!found)
      setLoading(false)
      // Sans réseau, rien n'est compté : le serveur n'a pas eu connaissance de
      // cette visite, et un compteur que l'on gonflerait ici serait faux.
      if (found && !local && !counted.current) {
        counted.current = true
        const key = `kartaa.seen.${found.id}`
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1')
          await repo.cards.registerScan(found.slug, 'qr')
        }
        // L'ouverture est comptée à chaque visite, le scan une seule fois par
        // session : revenir sur la page n'est pas un nouveau scan, mais c'est
        // bien une visite de plus.
        repo.cards.registerEvent(found.slug, 'view')
      }
    }).catch(() => null)
    return () => {
      cancelled = true
    }
  }, [slug])

  // La photo du propriétaire vient de la base : cette page est publique, elle ne
  // doit jamais emprunter la photo du visiteur qui la consulte.
  const assets = useCardAssets(card || {}, card?.ownerAvatarUrl || '')

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-brand-600">
        <Spinner size={28} />
      </div>
    )
  }

  if (!card) {
    // Deux situations très différentes, et il serait malhonnête de les
    // confondre : une page qui n'existe pas, et une page jamais ouverte sur cet
    // appareil alors que le réseau manque. Elle existe peut-être, mais elle n'a
    // jamais été téléchargée ici : rien ne permet de l'afficher.
    const sansReseau = typeof navigator !== 'undefined' && navigator.onLine === false
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50 px-5">
        <Panel className="max-w-sm text-center">
          <Icon name={sansReseau ? 'cloudOff' : 'search'} size={28} className="mx-auto mb-3 text-ink-300" />
          <p className="font-display font-bold text-ink-900">
            {sansReseau ? 'Connexion nécessaire' : "Cette page n'existe pas"}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
            {sansReseau
              ? `Cette page n'a jamais été ouverte sur cet appareil : il faut une connexion pour la récupérer une première fois.`
              : `Aucune carte ne correspond à l'adresse « /${slug} ».`}
          </p>
          <Button as={Link} to="/" className="mt-5" variant="outline">
            Découvrir Kartaa
          </Button>
        </Panel>
      </div>
    )
  }

  const adresse = publicUrl(card.slug)
  const fullName = [card.profile?.firstName, card.profile?.lastName].filter(Boolean).join(' ')

  /**
   * Signale une interaction au propriétaire de la carte.
   *
   * Ce qui est enregistré : le type d'action et, pour un réseau social, la
   * plateforme. Jamais qui a cliqué — il n'y a ni compte, ni identifiant, ni
   * adresse à rattacher au visiteur d'un mini-site public.
   */
  const suivre = (kind, detail = null) => repo.cards.registerEvent(card.slug, kind, detail)

  const enregistrerLeContact = async () => {
    suivre('vcard')
    const photo = await toDataUrl(assets.photoUrl)
    downloadVCard(card, photo)
    toast.success('Fiche contact téléchargée.')
  }

  const partager = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: fullName, url: adresse })
        return
      } catch {
        /* partage annulé */
      }
    }
    await copyToClipboard(adresse)
    toast.success('Lien copié.')
  }

  /**
   * La mention Kartaa en bas du profil public tombe avec l'abonnement Pro.
   *
   * `ownerPlan` est calculé par la base (card_by_slug → plan_of) : il vaut
   * « pro » exactement tant que l'abonnement est en cours, échéance comprise.
   * Ni le visiteur ni le propriétaire ne peuvent l'influencer — ce bandeau ne
   * dépend d'aucune valeur venue du navigateur. C'est la partie de la règle
   * « sans filigrane » qui est réellement inviolable.
   *
   * La comparaison portait auparavant sur « vip », un plan qui n'a jamais
   * existé : la mention s'affichait donc pour tout le monde, y compris pour les
   * abonnés qui l'avaient payée.
   */
  return (
    <ProfileView
      card={card}
      assets={assets}
      onTrack={suivre}
      onVcard={enregistrerLeContact}
      onShare={partager}
      publicHref={adresse}
      branded={card.ownerPlan !== 'pro'}
      entete={horsLigne ? (
        <p className="flex items-center justify-center gap-2 bg-gold-50 px-4 py-2 text-center text-xs font-semibold text-gold-800">
          <Icon name="cloudOff" size={14} />
          Mode hors connexion — dernières données disponibles
        </p>
      ) : null}
    />
  )
}
