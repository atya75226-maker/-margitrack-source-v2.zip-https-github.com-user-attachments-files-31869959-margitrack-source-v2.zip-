import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Panel, Spinner, Modal } from '../../components/ui'
import { Icon, Logo, SocialIcon } from '../../components/ui/Icons'
import { repo } from '../../lib/storage'
import { chargerProfilPublic } from '../../lib/offline/donnees'
import { useCardAssets } from '../../hooks/useCardAssets'
import { downloadVCard } from '../../lib/vcard'
import { toDataUrl } from '../../lib/storage'
import { copyToClipboard } from '../../lib/download'
import { ensureHttp, initialsOf, prettyUrl, telHref, whatsappHref } from '../../lib/format'
import { publicUrl } from '../../lib/slug'
import { groupByPlatform, linkHref, linkLabel, activeLinks } from '../../lib/socialLinks'
import { useToast } from '../../state/ToastContext'

/** Mini-site public : la page qu'ouvre le QR Code. Pensée d'abord pour le téléphone. */
export default function PublicProfilePage() {
  const { slug } = useParams()
  const toast = useToast()
  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [qrOpen, setQrOpen] = useState(false)
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

  const p = card.profile || {}
  const theme = { primary: '#6d28d9', accent: '#f5b229', ...(card.theme || {}) }
  const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ')
  const groups = groupByPlatform(card.socialLinks)
  const website = activeLinks(card.socialLinks).find((link) => link.platform === 'website')
  const branded = card.ownerPlan !== 'vip'

  /**
   * Signale une interaction au propriétaire de la carte.
   *
   * Ce qui est enregistré : le type d'action et, pour un réseau social, la
   * plateforme. Jamais qui a cliqué — il n'y a ni compte, ni identifiant, ni
   * adresse à rattacher au visiteur d'un mini-site public.
   */
  const suivre = (kind, detail = null) => repo.cards.registerEvent(card.slug, kind, detail)

  const addToContacts = async () => {
    suivre('vcard')
    const photo = await toDataUrl(assets.photoUrl)
    downloadVCard(card, photo)
    toast.success('Fiche contact téléchargée.')
  }

  return (
    <div className="min-h-screen bg-ink-50 pb-16">
      <div className="mx-auto w-full max-w-lg">
        {horsLigne && (
          <p className="flex items-center justify-center gap-2 bg-gold-50 px-4 py-2 text-center text-xs font-semibold text-gold-800">
            <Icon name="cloudOff" size={14} />
            Mode hors connexion — dernières données disponibles
          </p>
        )}
        {/* ------------------------------------------------------------ en-tête */}
        <header className="relative overflow-hidden px-6 pb-20 pt-12 text-center text-white" style={{ background: `linear-gradient(160deg, ${theme.primary} 0%, ${theme.primary}dd 45%, #0a0c18 100%)` }}>
          <span className="grain absolute inset-0 opacity-25" />
          <div className="relative">
            {assets.photoUrl ? (
              <img src={assets.photoUrl} alt={fullName} className="mx-auto h-28 w-28 rounded-full border-4 border-white/80 object-cover shadow-card" />
            ) : (
              <span className="mx-auto grid h-28 w-28 place-items-center rounded-full border-4 border-white/40 bg-white/15 font-display text-3xl font-bold">
                {initialsOf(p.firstName, p.lastName)}
              </span>
            )}
            <h1 className="mt-4 font-display text-2xl font-extrabold">{fullName}</h1>
            {p.profession && <p className="mt-1 text-sm font-semibold" style={{ color: theme.accent }}>{p.profession}</p>}
            {card.companies?.[0]?.name && <p className="mt-1 text-sm text-white/65">{card.companies[0].name}</p>}
            {(p.city || p.country) && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
                <Icon name="pin" size={13} /> {[p.city, p.country].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </header>

        <div className="relative z-10 -mt-12 space-y-4 px-4">
          {/* ------------------------------------------------------ actions */}
          <Panel className="!p-4">
            <div className="grid gap-2.5">
              {p.phone && (
                <ActionButton
                  href={telHref(p.phone)}
                  icon="phone"
                  label="Appeler"
                  value={p.phone}
                  tone="dark"
                  onTrack={() => suivre('call')}
                />
              )}
              {(p.whatsapp || p.phone) && (
                <ActionButton
                  href={whatsappHref(p.whatsapp || p.phone, `Bonjour ${p.firstName}, j'ai scanné votre carte.`)}
                  icon="whatsapp"
                  label="WhatsApp"
                  value="Discuter maintenant"
                  tone="whatsapp"
                  onTrack={() => suivre('whatsapp')}
                />
              )}
              {p.email && (
                <ActionButton
                  href={`mailto:${p.email}`}
                  icon="mail"
                  label="Envoyer un e-mail"
                  value={p.email}
                  onTrack={() => suivre('email')}
                />
              )}
              {website && (
                <ActionButton
                  href={ensureHttp(website.url)}
                  icon="globe"
                  label={website.title?.trim() || 'Visiter mon site'}
                  value={prettyUrl(website.url)}
                  onTrack={() => suivre('website')}
                />
              )}
            </div>
            <Button full size="lg" className="mt-3" icon="download" onClick={addToContacts} style={{ background: theme.primary }}>
              Ajouter aux contacts
            </Button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                icon="share"
                onClick={async () => {
                  const url = publicUrl(card.slug)
                  if (navigator.share) {
                    try {
                      await navigator.share({ title: fullName, url })
                      return
                    } catch {
                      /* partage annulé */
                    }
                  }
                  await copyToClipboard(url)
                  toast.success('Lien copié.')
                }}
              >
                Partager
              </Button>
              <Button variant="outline" size="sm" icon="qr" onClick={() => setQrOpen(true)}>
                Mon QR Code
              </Button>
            </div>
          </Panel>

          {/* -------------------------------------------------------- réseaux */}
          {groups.length > 0 && (
            <Panel className="!p-5">
              <SectionLabel icon="share" text="Mes réseaux" />
              <div className="space-y-4">
                {groups.map(({ network, items }) => (
                  <div key={network.key}>
                    <div className="mb-2 flex items-center gap-2.5">
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white"
                        style={{ background: network.color }}
                      >
                        <SocialIcon network={network.key} size={16} />
                      </span>
                      <span className="text-sm font-bold text-ink-800">{network.label}</span>
                      {items.length > 1 && (
                        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[0.65rem] font-bold text-ink-500">
                          {items.length}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 pl-[2.6rem]">
                      {items.map((link, index) => (
                        <a
                          key={link.id || link.url}
                          href={linkHref(link)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => suivre(network.key === 'whatsapp' ? 'whatsapp' : 'social', network.key)}
                          className="flex items-center gap-2 rounded-xl bg-ink-50 px-3.5 py-2.5 transition-colors hover:bg-ink-100"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink-800">
                              {linkLabel(link, index, items.length)}
                            </span>
                            <span className="block truncate text-xs text-ink-400">
                              {network.key === 'whatsapp' ? link.url : prettyUrl(link.url)}
                            </span>
                          </span>
                          <Icon name="chevronRight" size={16} className="shrink-0 text-ink-300" />
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* -------------------------------------------------------- à propos */}
          {card.about && (
            <Panel className="!p-5">
              <SectionLabel icon="user" text="À propos de moi" />
              <p className="text-sm leading-relaxed text-ink-600">{card.about}</p>
            </Panel>
          )}

          {!!card.activities?.length && (
            <Panel className="!p-5">
              <SectionLabel icon="sparkles" text="Mes activités" />
              <div className="flex flex-wrap gap-2">
                {card.activities.map((activity) => (
                  <span key={activity} className="rounded-full px-3.5 py-1.5 text-sm font-semibold" style={{ background: `${theme.primary}14`, color: theme.primary }}>
                    {activity}
                  </span>
                ))}
              </div>
            </Panel>
          )}

          {!!card.services?.length && (
            <Panel className="!p-5">
              <SectionLabel icon="briefcase" text="Mes services" />
              <div className="space-y-3">
                {card.services.map((service) => (
                  <ServiceCard key={service.id} service={service} theme={theme} />
                ))}
              </div>
            </Panel>
          )}

          {!!card.companies?.length && (
            <Panel className="!p-5">
              <SectionLabel icon="briefcase" text="Mes entreprises" />
              <div className="space-y-4">
                {card.companies.map((company) => (
                  <CompanyCard key={company.id} company={company} theme={theme} />
                ))}
              </div>
            </Panel>
          )}

          {!!card.gallery?.length && (
            <Panel className="!p-5">
              <SectionLabel icon="image" text="Ma galerie" />
              <Galerie photos={card.gallery} />
            </Panel>
          )}

          {(p.address || p.city) && (
            <Panel className="!p-5">
              <SectionLabel icon="pin" text="Adresse" />
              <p className="text-sm leading-relaxed text-ink-600">
                {[p.address, p.city, p.country].filter(Boolean).join(', ')}
              </p>
            </Panel>
          )}

          {branded && (
            <footer className="pt-4 text-center">
              <Link to="/" className="inline-flex flex-col items-center gap-2">
                <Logo size={28} />
                <span className="text-xs text-ink-400">Créez votre carte numérique gratuitement</span>
              </Link>
            </footer>
          )}
        </div>
      </div>

      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="Mon QR Code" size="sm">
        <div className="text-center">
          {assets.qr ? <img src={assets.qr} alt="QR Code" className="mx-auto h-56 w-56" /> : <Spinner />}
          <p className="mt-3 font-mono text-xs text-ink-500">{publicUrl(card.slug)}</p>
        </div>
      </Modal>
    </div>
  )
}

function ActionButton({ href, icon, label, value, tone = 'default', onTrack }) {
  const tones = {
    default: 'bg-ink-50 text-ink-800 hover:bg-ink-100',
    dark: 'bg-ink-900 text-white hover:bg-ink-800',
    whatsapp: 'bg-emerald-500 text-white hover:bg-emerald-600',
  }
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel="noreferrer"
      onClick={onTrack}
      className={`flex items-center gap-3.5 rounded-2xl px-4 py-3.5 transition-colors ${tones[tone]}`}
    >
      <Icon name={icon} size={20} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{label}</span>
        <span className={`block truncate text-xs ${tone === 'default' ? 'text-ink-400' : 'opacity-70'}`}>{value}</span>
      </span>
      <Icon name="chevronRight" size={17} className="shrink-0 opacity-50" />
    </a>
  )
}

/**
 * Galerie du mini-site. Une grille de vignettes, et la photo en grand au
 * toucher — sur un téléphone, une vignette de 100 px ne montre rien.
 */
function Galerie({ photos }) {
  const [agrandie, setAgrandie] = useState(null)
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <button
            key={photo.id || photo.url}
            type="button"
            onClick={() => setAgrandie(photo)}
            className="aspect-square overflow-hidden rounded-xl bg-ink-100"
          >
            <img
              src={photo.url}
              alt={photo.caption || ''}
              loading="lazy"
              className="h-full w-full object-cover transition-transform active:scale-95"
            />
          </button>
        ))}
      </div>
      <Modal open={!!agrandie} onClose={() => setAgrandie(null)} title="" size="lg">
        {agrandie && (
          <img src={agrandie.url} alt={agrandie.caption || ''} className="w-full rounded-2xl" />
        )}
      </Modal>
    </>
  )
}

function ServiceCard({ service, theme }) {
  const photoUrl = service.photoUrl
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-100">
      {photoUrl && <img src={photoUrl} alt="" className="h-36 w-full object-cover" />}
      <div className="p-4">
        <p className="font-display text-sm font-bold text-ink-900">{service.name}</p>
        {service.description && <p className="mt-1 text-sm leading-relaxed text-ink-500">{service.description}</p>}
        {service.price && (
          <p className="mt-2 text-sm font-extrabold" style={{ color: theme.primary }}>
            {service.price}
          </p>
        )}
      </div>
    </div>
  )
}

function CompanyCard({ company, theme }) {
  const logoUrl = company.logoUrl
  const socials = (company.socials || []).filter((social) => social.value)
  return (
    <div className="rounded-2xl border border-ink-100 p-4">
      <div className="flex items-center gap-3.5">
        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-ink-100 text-ink-500">
          {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : <Icon name="briefcase" size={20} />}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-ink-900">{company.name}</p>
          {company.address && <p className="truncate text-xs text-ink-400">{company.address}</p>}
        </div>
      </div>
      {company.description && <p className="mt-3 text-sm leading-relaxed text-ink-600">{company.description}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {company.phone && (
          <a href={telHref(company.phone)} className="flex items-center gap-1.5 rounded-full bg-ink-50 px-3 py-1.5 text-xs font-bold text-ink-700">
            <Icon name="phone" size={13} /> Appeler
          </a>
        )}
        {company.whatsapp && (
          <a href={whatsappHref(company.whatsapp)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <Icon name="whatsapp" size={13} /> WhatsApp
          </a>
        )}
        {company.website && (
          <a href={ensureHttp(company.website)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: `${theme.primary}14`, color: theme.primary }}>
            <Icon name="globe" size={13} /> Site web
          </a>
        )}
        {socials.map((social) => (
          <a
            key={social.key}
            href={ensureHttp(social.value)}
            target="_blank"
            rel="noreferrer"
            className="grid h-7 w-7 place-items-center rounded-full bg-ink-50 text-ink-600"
          >
            <SocialIcon network={social.key} size={13} />
          </a>
        ))}
      </div>
    </div>
  )
}

function SectionLabel({ icon, text }) {
  return (
    <p className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.15em] text-ink-400">
      <Icon name={icon} size={14} />
      {text}
    </p>
  )
}
