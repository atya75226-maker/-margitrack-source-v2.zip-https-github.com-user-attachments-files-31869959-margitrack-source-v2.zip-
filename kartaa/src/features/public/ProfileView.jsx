import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Modal, Panel } from '../../components/ui'
import { Icon, Logo, SocialIcon } from '../../components/ui/Icons'
import { ensureHttp, initialsOf, prettyUrl, telHref, whatsappHref } from '../../lib/format'
import { groupByPlatform, linkHref, linkLabel } from '../../lib/socialLinks'
import { NETWORK_BY_KEY } from '../../config/app.config'

/**
 * Le profil public, tel qu'il s'affiche après un scan.
 *
 * Ce composant ne va chercher aucune donnée : il reçoit une carte déjà chargée
 * et se contente de la présenter. C'est ce qui permet de le montrer aussi sur
 * la page d'accueil, avec un exemple, sans écrire deux fois la même page — la
 * démonstration de la vitrine est donc, au pixel près, le produit réel.
 *
 * RÈGLE TENUE PARTOUT ICI : rien n'est affiché qui n'existe pas. Pas de bouton
 * « Appeler » sans numéro, pas d'icône de réseau non renseigné, pas de section
 * vide. Un profil peu rempli doit rester présentable, pas troué.
 */

/** Les trois typographies proposées, telles que l'application les charge. */
const POLICES = {
  sans: "'Plus Jakarta Sans', system-ui, sans-serif",
  display: "'Sora', 'Plus Jakarta Sans', sans-serif",
  serif: "'Fraunces', Georgia, serif",
}

/** Liens qui ne sont pas des réseaux : sites et autres adresses, présentés à part. */
const PLATEFORMES_LIEN = ['website', 'other']

export default function ProfileView({
  card,
  assets,
  onTrack = () => {},
  onVcard = null,
  onShare = null,
  publicHref = '',
  actif = true,
  branded = true,
  entete = null,
}) {
  const [qrOuvert, setQrOuvert] = useState(false)
  const p = card.profile || {}
  const theme = { primary: '#6d28d9', accent: '#f5b229', font: 'sans', ...(card.theme || {}) }
  const police = POLICES[theme.font] || POLICES.sans
  const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ')
  const entreprise = card.companies?.[0]?.name?.trim() || ''
  const lieu = [p.city, p.country].filter(Boolean).join(', ')

  const groupes = groupByPlatform(card.socialLinks)
  // Les réseaux passent en ligne horizontale ; les sites et autres adresses
  // méritent leur libellé en toutes lettres, donc leur propre section.
  const reseaux = groupes.filter((groupe) => !PLATEFORMES_LIEN.includes(groupe.network.key))
  const liens = groupes.filter((groupe) => PLATEFORMES_LIEN.includes(groupe.network.key))

  const contacts = [
    p.phone && { cle: 'call', icone: 'phone', label: 'Appeler', href: telHref(p.phone), ton: 'sombre' },
    (p.whatsapp || p.phone) && {
      cle: 'whatsapp',
      icone: 'whatsapp',
      label: 'WhatsApp',
      href: whatsappHref(p.whatsapp || p.phone, `Bonjour ${p.firstName || ''}`.trim()),
      ton: 'whatsapp',
      externe: true,
    },
    p.email && { cle: 'email', icone: 'mail', label: 'E-mail', href: `mailto:${p.email}` },
  ].filter(Boolean)

  return (
    <div className="min-h-full bg-ink-50 pb-14" style={{ fontFamily: police }}>
      <div className="mx-auto w-full max-w-lg">
        {entete}

        {/* ------------------------------------------------------------ en-tête */}
        <header
          className="relative overflow-hidden px-6 pb-24 pt-14 text-center text-white"
          style={{ background: `linear-gradient(165deg, ${theme.primary} 0%, ${theme.primary}cc 42%, #0a0c18 100%)` }}
        >
          <span className="grain absolute inset-0 opacity-25" />
          <span
            className="absolute -right-16 -top-16 h-52 w-52 rounded-full opacity-30 blur-2xl"
            style={{ background: theme.accent }}
          />
          <div className="relative">
            {assets?.photoUrl ? (
              <img
                src={assets.photoUrl}
                alt={fullName}
                className="mx-auto h-32 w-32 rounded-full object-cover shadow-card ring-4 ring-white/85"
              />
            ) : (
              <span className="mx-auto grid h-32 w-32 place-items-center rounded-full bg-white/15 font-display text-4xl font-bold ring-4 ring-white/40">
                {initialsOf(p.firstName, p.lastName)}
              </span>
            )}
            {fullName && (
              <h1 className="mt-5 font-display text-[1.7rem] font-extrabold leading-tight tracking-tight">{fullName}</h1>
            )}
            {p.profession && (
              <p className="mt-1.5 text-[0.95rem] font-bold" style={{ color: theme.accent }}>
                {p.profession}
              </p>
            )}
            {(entreprise || lieu) && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {entreprise && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold">
                    <Icon name="briefcase" size={13} /> {entreprise}
                  </span>
                )}
                {lieu && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold">
                    <Icon name="pin" size={13} /> {lieu}
                  </span>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="relative z-10 -mt-16 space-y-4 px-4">
          {/* ------------------------------------------------------ contacter */}
          {(contacts.length > 0 || onVcard) && (
            <Panel className="!p-4">
              {contacts.length > 0 && (
                <div className={`grid gap-2 ${contacts.length === 1 ? 'grid-cols-1' : contacts.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {contacts.map((contact) => (
                    <Contact key={contact.cle} {...contact} actif={actif} onTrack={() => onTrack(contact.cle)} />
                  ))}
                </div>
              )}
              {onVcard && (
                <Button
                  full
                  size="lg"
                  className={contacts.length ? 'mt-2.5' : ''}
                  icon="download"
                  onClick={actif ? onVcard : undefined}
                  style={{ background: theme.primary }}
                >
                  Enregistrer le contact
                </Button>
              )}
              {(onShare || publicHref) && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {onShare && (
                    <Button variant="outline" size="sm" icon="share" onClick={onShare}>
                      Partager
                    </Button>
                  )}
                  {publicHref && (
                    <Button variant="outline" size="sm" icon="qr" onClick={() => setQrOuvert(true)}>
                      QR Code
                    </Button>
                  )}
                </div>
              )}
            </Panel>
          )}

          {/* -------------------------------------------------------- réseaux */}
          {reseaux.length > 0 && (
            <Panel className="!px-4 !py-5">
              <Reseaux groupes={reseaux} actif={actif} onTrack={onTrack} />
            </Panel>
          )}

          {/* ------------------------------------------------- sites et liens */}
          {liens.length > 0 && (
            <Panel className="!p-5">
              <SectionLabel icon="link" text="Mes liens" />
              <div className="space-y-2">
                {liens.flatMap(({ network, items }) =>
                  items.map((lien, index) => (
                    <a
                      key={lien.id || lien.uid || `${network.key}-${index}`}
                      href={actif ? linkHref(lien) : undefined}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => onTrack('website', network.key)}
                      className="flex items-center gap-3 rounded-2xl border border-ink-100 px-4 py-3 transition-colors hover:border-ink-200 hover:bg-ink-50"
                    >
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
                        style={{ background: network.color }}
                      >
                        <SocialIcon network={network.key} size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink-900">
                          {linkLabel(lien, index, items.length)}
                        </span>
                        <span className="block truncate text-xs text-ink-400">{prettyUrl(lien.url)}</span>
                      </span>
                      <Icon name="chevronRight" size={17} className="shrink-0 text-ink-300" />
                    </a>
                  )),
                )}
              </div>
            </Panel>
          )}

          {/* -------------------------------------------------------- à propos */}
          {card.about && (
            <Panel className="!p-5">
              <SectionLabel icon="user" text="À propos" />
              <p className="text-sm leading-relaxed text-ink-600">{card.about}</p>
            </Panel>
          )}

          {!!card.activities?.length && (
            <Panel className="!p-5">
              <SectionLabel icon="sparkles" text="Mes activités" />
              <div className="flex flex-wrap gap-2">
                {card.activities.map((activite) => (
                  <span
                    key={activite}
                    className="rounded-full px-3.5 py-1.5 text-sm font-semibold"
                    style={{ background: `${theme.primary}14`, color: theme.primary }}
                  >
                    {activite}
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
                  <CompanyCard key={company.id} company={company} theme={theme} actif={actif} />
                ))}
              </div>
            </Panel>
          )}

          {!!card.gallery?.length && (
            <Panel className="!p-5">
              <SectionLabel icon="image" text="Ma galerie" />
              <Galerie photos={card.gallery} actif={actif} />
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
            <footer className="pt-5 text-center">
              {actif ? (
                <Link to="/" className="inline-flex flex-col items-center gap-2">
                  <Logo size={28} />
                  <span className="text-xs text-ink-400">Créez votre profil professionnel gratuitement</span>
                </Link>
              ) : (
                <span className="inline-flex flex-col items-center gap-2">
                  <Logo size={28} />
                  <span className="text-xs text-ink-400">Créez votre profil professionnel gratuitement</span>
                </span>
              )}
            </footer>
          )}
        </div>
      </div>

      {publicHref && (
        <Modal open={qrOuvert} onClose={() => setQrOuvert(false)} title="Mon QR Code" size="sm">
          <div className="text-center">
            {assets?.qr ? <img src={assets.qr} alt="QR Code" className="mx-auto h-56 w-56" /> : null}
            <p className="mt-3 break-all font-mono text-xs text-ink-500">{publicHref}</p>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ pièces */

/** Un moyen de contact : une tuile, une icône, un mot. */
function Contact({ icone, label, href, ton, externe, actif, onTrack }) {
  const tons = {
    sombre: 'bg-ink-900 text-white hover:bg-ink-800',
    whatsapp: 'bg-emerald-500 text-white hover:bg-emerald-600',
    clair: 'bg-ink-50 text-ink-800 hover:bg-ink-100',
  }
  return (
    <a
      href={actif ? href : undefined}
      target={externe ? '_blank' : undefined}
      rel="noreferrer"
      onClick={onTrack}
      className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5 transition-colors ${tons[ton] || tons.clair}`}
    >
      <Icon name={icone} size={20} />
      <span className="text-xs font-bold">{label}</span>
    </a>
  )
}

/**
 * Les réseaux, en ligne.
 *
 * Une plateforme peut porter plusieurs comptes — c'est une vraie possibilité de
 * Kartaa. Un seul compte : l'icône ouvre directement le lien. Plusieurs : elle
 * déplie la liste, parce qu'une icône ne peut pas mener à deux endroits.
 */
function Reseaux({ groupes, actif, onTrack }) {
  const [deplie, setDeplie] = useState(null)
  const groupeOuvert = groupes.find((groupe) => groupe.network.key === deplie)

  return (
    <>
      <SectionLabel icon="share" text="Mes réseaux" />
      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {groupes.map(({ network, items }) => {
          const unique = items.length === 1
          const commun = 'relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-soft transition-transform active:scale-95'
          const contenu = (
            <>
              <SocialIcon network={network.key} size={22} />
              {items.length > 1 && (
                <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-white text-[0.65rem] font-extrabold text-ink-800 shadow-soft">
                  {items.length}
                </span>
              )}
            </>
          )
          return unique ? (
            <a
              key={network.key}
              href={actif ? linkHref(items[0]) : undefined}
              target="_blank"
              rel="noreferrer"
              title={network.label}
              aria-label={network.label}
              onClick={() => onTrack(network.key === 'whatsapp' ? 'whatsapp' : 'social', network.key)}
              className={commun}
              style={{ background: network.color }}
            >
              {contenu}
            </a>
          ) : (
            <button
              key={network.key}
              type="button"
              title={network.label}
              aria-label={network.label}
              onClick={() => setDeplie(deplie === network.key ? null : network.key)}
              className={commun}
              style={{ background: network.color }}
            >
              {contenu}
            </button>
          )
        })}
      </div>

      {groupeOuvert && (
        <div className="mt-3 space-y-1.5 rounded-2xl bg-ink-50 p-2">
          {groupeOuvert.items.map((lien, index) => (
            <a
              key={lien.id || lien.uid || index}
              href={actif ? linkHref(lien) : undefined}
              target="_blank"
              rel="noreferrer"
              onClick={() => onTrack(groupeOuvert.network.key === 'whatsapp' ? 'whatsapp' : 'social', groupeOuvert.network.key)}
              className="flex items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink-800">
                  {linkLabel(lien, index, groupeOuvert.items.length)}
                </span>
                <span className="block truncate text-xs text-ink-400">
                  {groupeOuvert.network.key === 'whatsapp' ? lien.url : prettyUrl(lien.url)}
                </span>
              </span>
              <Icon name="chevronRight" size={16} className="shrink-0 text-ink-300" />
            </a>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * Galerie du mini-site. Une grille de vignettes, et la photo en grand au
 * toucher — sur un téléphone, une vignette de 100 px ne montre rien.
 */
function Galerie({ photos, actif }) {
  const [agrandie, setAgrandie] = useState(null)
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <button
            key={photo.id || photo.url}
            type="button"
            onClick={() => actif && setAgrandie(photo)}
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
        {agrandie && <img src={agrandie.url} alt={agrandie.caption || ''} className="w-full rounded-2xl" />}
      </Modal>
    </>
  )
}

function ServiceCard({ service, theme }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-100">
      {service.photoUrl && <img src={service.photoUrl} alt="" className="h-36 w-full object-cover" />}
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

function CompanyCard({ company, theme, actif }) {
  const socials = (company.socials || []).filter((social) => social.value)
  return (
    <div className="rounded-2xl border border-ink-100 p-4">
      <div className="flex items-center gap-3.5">
        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-ink-100 text-ink-500">
          {company.logoUrl ? (
            <img src={company.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon name="briefcase" size={20} />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-ink-900">{company.name}</p>
          {company.address && <p className="truncate text-xs text-ink-400">{company.address}</p>}
        </div>
      </div>
      {company.description && <p className="mt-3 text-sm leading-relaxed text-ink-600">{company.description}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {company.phone && (
          <a
            href={actif ? telHref(company.phone) : undefined}
            className="flex items-center gap-1.5 rounded-full bg-ink-50 px-3 py-1.5 text-xs font-bold text-ink-700"
          >
            <Icon name="phone" size={13} /> Appeler
          </a>
        )}
        {company.whatsapp && (
          <a
            href={actif ? whatsappHref(company.whatsapp) : undefined}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"
          >
            <Icon name="whatsapp" size={13} /> WhatsApp
          </a>
        )}
        {company.website && (
          <a
            href={actif ? ensureHttp(company.website) : undefined}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
            style={{ background: `${theme.primary}14`, color: theme.primary }}
          >
            <Icon name="globe" size={13} /> Site web
          </a>
        )}
        {socials.map((social) => (
          <a
            key={social.key}
            href={actif ? ensureHttp(social.value) : undefined}
            target="_blank"
            rel="noreferrer"
            title={NETWORK_BY_KEY[social.key]?.label || social.key}
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
