import { useState } from 'react'
import { Link } from 'react-router-dom'
import { APP } from '../../config/app.config'
import { Icon, Logo, SocialIcon } from '../../components/ui/Icons'
import { Badge, Button } from '../../components/ui'
import { CardArtwork, CardScaler } from '../../components/card/CardArtwork'
import { useQrCode } from '../../hooks/useCardAssets'
import { DEMO_CARDS } from './demoCards'
import { useAuth } from '../../state/AuthContext'
import { InstallButton, useModeInstallation } from '../../components/InstallApp'

const FEATURES = [
  {
    icon: 'card',
    title: 'Carte de visite numérique',
    text: "Votre nom, votre photo, votre téléphone, WhatsApp, e-mail, réseaux sociaux, activité, entreprise et présentation — réunis sur une carte professionnelle.",
    points: ['Trois familles de design', 'Couleurs et typographie ajustables', 'Téléchargeable en PNG, JPG ou PDF'],
  },
  {
    icon: 'globe',
    title: 'Mini-site personnel',
    text: "Votre QR Code ouvre une page personnalisée qui présente votre profil, vos activités, vos services, votre entreprise et vos coordonnées.",
    points: ['Boutons Appeler, WhatsApp, e-mail', 'Ajout direct aux contacts', 'Une adresse courte à partager'],
  },
]

const STEPS = [
  { icon: 'edit', title: 'Vous renseignez vos informations', text: "Un assistant en quelques étapes : identité, réseaux, présentation, entreprises et services." },
  { icon: 'palette', title: "L'application crée votre carte", text: 'Choisissez un modèle, ajustez les couleurs, prévisualisez le rendu exact.' },
  { icon: 'qr', title: 'Votre QR Code fait le reste', text: "Un scan suffit pour ouvrir votre identité numérique et vous ajouter aux contacts." },
]

const FAQ = [
  {
    q: "Faut-il installer une application ?",
    a: "Non. Kartaa fonctionne dans le navigateur, sur téléphone comme sur ordinateur. La personne qui scanne votre QR Code n'a rien à installer non plus.",
  },
  {
    q: 'Que contient exactement le QR Code ?',
    a: "Uniquement l'adresse de votre mini-site. Ni votre numéro, ni vos fichiers n'y sont inscrits : vous pouvez modifier vos informations sans réimprimer quoi que ce soit.",
  },
]

export default function LandingPage() {
  const { isAuthenticated } = useAuth()
  return (
    <div className="bg-white">
      <Header isAuthenticated={isAuthenticated} />
      <Hero />
      <Features />
      <Examples />
      <HowItWorks />
      <Pricing />
      <Faq />
      <FinalCta />
      <InstallSection />
      <Footer />
    </div>
  )
}

/* ----------------------------------------------------------------- entête */

function Header({ isAuthenticated }) {
  const [open, setOpen] = useState(false)
  const links = [
    { href: '#fonctionnalites', label: 'Fonctionnalités' },
    { href: '#exemples', label: 'Exemples' },
    { href: '#offres', label: 'Offres' },
  ]
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur-xl">
      <div className="container-app flex items-center justify-between py-3.5">
        <Link to="/">
          <Logo tone="light" />
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-semibold text-white/70 transition-colors hover:text-white">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <Button as={Link} to="/app" variant="gold" size="sm" iconRight="arrowRight">
              Mon tableau de bord
            </Button>
          ) : (
            <>
              <Button as={Link} to="/connexion" variant="ghost" size="sm" className="text-white/80 hover:bg-white/10 hover:text-white">
                Connexion
              </Button>
              <Button as={Link} to="/inscription" variant="gold" size="sm">
                Créer ma carte
              </Button>
            </>
          )}
        </div>
        <button type="button" className="rounded-xl p-2 text-white md:hidden" onClick={() => setOpen((value) => !value)} aria-label="Menu">
          <Icon name={open ? 'x' : 'list'} size={22} />
        </button>
      </div>
      {open && (
        <div className="border-t border-white/10 bg-ink-950 px-5 py-4 md:hidden">
          <div className="space-y-1">
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10">
                {link.label}
              </a>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button as={Link} to="/connexion" variant="outline" full size="sm" className="border-white/20 bg-transparent text-white hover:bg-white/10">
              Connexion
            </Button>
            <Button as={Link} to="/inscription" variant="gold" full size="sm">
              Créer ma carte
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}

/* -------------------------------------------------------------------- hero */

function Hero() {
  const card = DEMO_CARDS[1]
  const qr = useQrCode(`https://${APP.publicDomain}/${card.slug}`)
  return (
    <section className="relative overflow-hidden bg-ink-950 pb-24 pt-14 text-white sm:pt-20">
      <div className="mesh absolute inset-0 opacity-90" />
      <div className="grain absolute inset-0 opacity-30" />
      <div className="container-app relative grid items-center gap-14 lg:grid-cols-[1.05fr,1fr]">
        <div className="min-w-0 animate-fade-up">
          <Badge tone="dark" className="mb-6 border border-white/15 bg-white/10 text-white">
            <Icon name="sparkles" size={13} /> Carte de visite • Mini-site • QR Code
          </Badge>
          <h1 className="font-display text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-balance sm:text-6xl">
            Votre identité.
            <br />
            Votre carte.
            <br />
            <span className="bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-transparent">Votre QR Code.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[1.05rem] leading-relaxed text-white/70">
            Créez votre carte de visite numérique, partagez toutes vos coordonnées en un seul scan et protégez vos
            un seul scan.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button as={Link} to="/inscription" size="lg" variant="gold" icon="card">
              Créer ma carte gratuitement
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/55">
            <span className="flex items-center gap-2"><Icon name="check" size={16} className="text-gold-400" /> Gratuit pour commencer</span>
            <span className="flex items-center gap-2"><Icon name="check" size={16} className="text-gold-400" /> Sans installation</span>
            <span className="flex items-center gap-2"><Icon name="check" size={16} className="text-gold-400" /> Prêt pour l'Afrique et l'international</span>
          </div>
        </div>

        <div className="relative min-w-0 animate-fade-up [animation-delay:120ms]">
          <div className="absolute -inset-8 rounded-[3rem] bg-white/5 blur-2xl" />
          <div className="flex min-w-0 items-center justify-center gap-4">
            <div className="w-full max-w-[330px] rotate-[-3deg] overflow-hidden rounded-3xl shadow-card transition-transform duration-500 hover:rotate-0">
              <CardScaler maxWidth={330}>
                <CardArtwork card={card} qr={qr} />
              </CardScaler>
            </div>
            <PhoneMockup card={card} qr={qr} className="hidden w-[165px] shrink-0 translate-y-6 sm:block" />
          </div>
        </div>
      </div>
    </section>
  )
}

function PhoneMockup({ card, qr, className = '' }) {
  const p = card.profile
  return (
    <div className={`rounded-[2rem] border-[6px] border-ink-900 bg-white shadow-card ${className}`}>
      <div className="h-5 rounded-t-[1.5rem] bg-ink-900" />
      <div className="bg-gradient-to-b from-brand-700 to-brand-900 px-4 pb-5 pt-4 text-center text-white">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/20 font-display text-lg font-bold">
          {p.firstName[0]}{p.lastName[0]}
        </div>
        <p className="mt-2 font-display text-sm font-bold">{p.firstName} {p.lastName}</p>
        <p className="text-[0.6rem] text-white/70">{p.profession}</p>
      </div>
      <div className="space-y-1.5 p-3">
        {['Appeler', 'WhatsApp', 'Envoyer un e-mail'].map((label, index) => (
          <div key={label} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[0.62rem] font-bold ${index === 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-50 text-ink-700'}`}>
            <Icon name={['phone', 'whatsapp', 'mail'][index]} size={12} />
            {label}
          </div>
        ))}
        <div className="flex justify-center gap-1.5 pt-1">
          {['instagram', 'linkedin', 'website'].map((key) => (
            <span key={key} className="grid h-6 w-6 place-items-center rounded-lg bg-ink-100 text-ink-600">
              <SocialIcon network={key} size={12} />
            </span>
          ))}
        </div>
        {qr && <img src={qr} alt="" className="mx-auto mt-2 h-14 w-14" />}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ fonctionnalités */

function Features() {
  return (
    <section id="fonctionnalites" className="container-app py-20 sm:py-24">
      <SectionHeading
        eyebrow="Trois produits, une seule application"
        title="Tout ce qu'il faut pour exister en ligne, proprement."
        subtitle="Pas un générateur de QR Code de plus : une identité professionnelle complète."
      />
      <div className="grid gap-5 md:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <article
            key={feature.title}
            className="group rounded-3xl border border-ink-100 bg-white p-7 shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
              <Icon name={feature.icon} size={24} />
            </span>
            <h3 className="font-display text-lg font-bold text-ink-900">{feature.title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-500">{feature.text}</p>
            <ul className="mt-5 space-y-2 border-t border-ink-100 pt-5">
              {feature.points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm font-medium text-ink-700">
                  <Icon name="check" size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                  {point}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- exemples */

function Examples() {
  const [active, setActive] = useState(1)
  const card = DEMO_CARDS[active]
  const qr = useQrCode(`https://${APP.publicDomain}/${card.slug}`)
  return (
    <section id="exemples" className="bg-ink-50 py-20 sm:py-24">
      <div className="container-app">
        <SectionHeading
          eyebrow="Exemples"
          title="Des cartes que l'on est fier de présenter."
          subtitle="Standard, Premium ou VIP : le même contenu, trois niveaux de finition. Chaque carte porte son propre QR Code."
        />
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {DEMO_CARDS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(index)}
              className={`rounded-2xl px-5 py-2.5 text-sm font-bold transition-all ${
                active === index ? 'bg-ink-900 text-white shadow-soft' : 'bg-white text-ink-500 hover:text-ink-900'
              }`}
            >
              {['Standard', 'Premium', 'VIP'][index]}
            </button>
          ))}
        </div>
        <div className="grid items-center gap-10 lg:grid-cols-[1.3fr,1fr]">
          <div className="overflow-hidden rounded-3xl shadow-card">
            <CardScaler maxWidth={720}>
              <CardArtwork card={card} side="back" qr={qr} />
            </CardScaler>
          </div>
          <div className="rounded-3xl border border-ink-100 bg-white p-7 shadow-soft">
            <div className="mb-5 flex items-center gap-3">
              {qr && <img src={qr} alt="QR Code d'exemple" className="h-24 w-24 rounded-xl border border-ink-100 p-1" />}
              <div>
                <p className="font-display text-base font-bold text-ink-900">Le QR Code de {card.profile.firstName}</p>
                <p className="mt-1 text-sm text-ink-500">
                  Il ouvre <span className="font-mono text-xs text-brand-700">{APP.publicDomain}/{card.slug}</span>
                </p>
              </div>
            </div>
            <ul className="space-y-3 text-sm text-ink-600">
              {[
                'Il ne contient aucune donnée personnelle, seulement un lien.',
                'Vous modifiez vos informations : le QR Code reste valable.',
                'Il fonctionne avec l’appareil photo de tous les téléphones.',
              ].map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <Icon name="check" size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  {point}
                </li>
              ))}
            </ul>
            <Button as={Link} to="/inscription" full className="mt-6" iconRight="arrowRight">
              Créer la mienne
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ fonctionnement */

function HowItWorks() {
  return (
    <section className="container-app py-20 sm:py-24">
      <SectionHeading eyebrow="En trois temps" title="Le principe tient en une phrase." subtitle="Je renseigne mes informations, l'application crée ma carte, mon QR Code donne accès à mon identité numérique." />
      <div className="grid gap-5 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step.title} className="relative rounded-3xl border border-ink-100 bg-white p-7 shadow-soft">
            <span className="absolute right-6 top-6 font-display text-4xl font-extrabold text-ink-100">{index + 1}</span>
            <span className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-gold-100 text-gold-700">
              <Icon name={step.icon} size={22} />
            </span>
            <h3 className="font-display text-base font-bold text-ink-900">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">{step.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ offres */

const OFFRES = [
  {
    id: 'free',
    name: 'Gratuit',
    price: '0',
    period: 'pour toujours',
    tagline: 'Tout ce qu\'il faut pour commencer.',
    features: [
      'Une carte de visite et son QR Code',
      'Mini-site public',
      'Réseaux sociaux et liens illimités',
      'Coordonnées, WhatsApp et e-mail',
      'Scanner de QR Code universel',
      'Français et anglais',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '5 000',
    currency: 'FCFA',
    period: '/ mois',
    tagline: 'Pour les professionnels et les entreprises.',
    highlight: true,
    features: [
      'Cartes Premium et VIP',
      'Plusieurs cartes',
      'Mini-site avancé',
      'Statistiques avancées',
      'Suppression du branding Kartaa',
    ],
  },
]

function Pricing() {
  return (
    <section id="offres" className="container-app py-20 sm:py-24">
      <SectionHeading
        eyebrow="Offres"
        title="Une seule offre payante, sans surprise."
        subtitle="Commencez gratuitement. Quand vous avez besoin de plus, tout se débloque d'un coup avec Pro."
      />
      <div className="mx-auto grid max-w-3xl gap-5 md:grid-cols-2">
        {OFFRES.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-3xl border p-7 ${
              plan.highlight ? 'border-brand-600 bg-ink-950 text-white shadow-card' : 'border-ink-100 bg-white shadow-soft'
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-7 rounded-full bg-gold-400 px-3 py-1 text-xs font-extrabold text-ink-900">
                Tout compris
              </span>
            )}
            <h3 className="font-display text-lg font-bold">{plan.name}</h3>
            <p className={`mt-1 text-sm ${plan.highlight ? 'text-white/60' : 'text-ink-500'}`}>{plan.tagline}</p>
            <p className="mt-5 flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-extrabold">{plan.price}</span>
              <span className={`text-sm font-semibold ${plan.highlight ? 'text-white/60' : 'text-ink-400'}`}>
                {plan.currency || ''} {plan.period}
              </span>
            </p>
            <ul className="mt-6 flex-1 space-y-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className={`flex items-start gap-2.5 text-sm ${plan.highlight ? 'text-white/80' : 'text-ink-600'}`}>
                  <Icon name="check" size={16} className={`mt-0.5 shrink-0 ${plan.highlight ? 'text-gold-400' : 'text-emerald-600'}`} />
                  {feature}
                </li>
              ))}
            </ul>
            <Button as={Link} to="/inscription" full className="mt-7" variant={plan.highlight ? 'gold' : 'outline'}>
              {plan.id === 'free' ? 'Commencer gratuitement' : 'Passer à Pro'}
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center hint">Prix en francs CFA. Aucun paiement n'est encore prélevé.</p>
    </section>
  )
}

/* --------------------------------------------------------------------- faq */

function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <section className="bg-ink-50 py-20 sm:py-24">
      <div className="container-app max-w-3xl">
        <SectionHeading eyebrow="Questions" title="Ce qu'on nous demande le plus." />
        <div className="space-y-3">
          {FAQ.map((item, index) => (
            <div key={item.q} className="overflow-hidden rounded-2xl border border-ink-100 bg-white">
              <button
                type="button"
                onClick={() => setOpen(open === index ? -1 : index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="font-display text-sm font-bold text-ink-900">{item.q}</span>
                <Icon name="chevronDown" size={18} className={`shrink-0 text-ink-400 transition-transform ${open === index ? 'rotate-180' : ''}`} />
              </button>
              {open === index && <p className="border-t border-ink-100 px-5 py-4 text-sm leading-relaxed text-ink-600">{item.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="container-app py-20">
      <div className="relative overflow-hidden rounded-[2rem] bg-ink-950 px-8 py-14 text-center text-white sm:px-16">
        <div className="mesh absolute inset-0 opacity-70" />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-extrabold leading-tight text-balance sm:text-4xl">
            Votre prochaine poignée de main mérite mieux qu'un bout de carton.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">Créez votre carte en quelques minutes. C'est gratuit, et votre QR Code est prêt immédiatement.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button as={Link} to="/inscription" size="lg" variant="gold" icon="rocket">
              Créer ma carte gratuitement
            </Button>
            <Button as={Link} to="/connexion" size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
              J'ai déjà un compte
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Installation depuis la page publique.
 *
 * L'installation ne doit pas dépendre d'un compte : quelqu'un qui découvre le
 * site doit pouvoir poser l'application sur son écran d'accueil tout de suite.
 * Le bloc disparaît de lui-même une fois l'application installée.
 */
/**
 * Installation depuis la page publique.
 *
 * L'installation ne doit pas dépendre d'un compte : quelqu'un qui découvre le
 * site doit pouvoir poser l'application sur son écran d'accueil tout de suite.
 * Le bloc disparaît de lui-même une fois l'application installée.
 */
function InstallSection() {
  const mode = useModeInstallation()
  if (mode === 'installee') return null

  return (
    <section className="border-t border-ink-100 bg-ink-50 py-12">
      <div className="container-app">
        <div className="mx-auto max-w-xl text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white">
            <Icon name="download" size={24} />
          </span>
          <h2 className="font-display text-2xl font-extrabold text-ink-900">
            Installez {APP.name} sur votre téléphone
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            Depuis votre navigateur, sans magasin d'applications. Elle s'ouvre en plein écran et
            garde votre session.
          </p>
          <div className="mt-6">
            <InstallButton />
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-ink-100 bg-white py-10">
      <div className="container-app flex flex-col items-center justify-between gap-6 sm:flex-row">
        <Logo size={30} />
        <p className="text-center text-xs text-ink-400">
          Prototype — les paiements, l'impression physique et l'enregistrement de domaines ne sont pas encore activés.
        </p>
        <div className="flex gap-2">
          <Link to="/connexion" className="text-sm font-semibold text-ink-500 hover:text-ink-900">Connexion</Link>
          <span className="text-ink-200">•</span>
          <Link to="/inscription" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Créer un compte</Link>
        </div>
      </div>
    </footer>
  )
}

function SectionHeading({ eyebrow, title, subtitle }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      {eyebrow && <p className="mb-3 text-xs font-extrabold uppercase tracking-[.2em] text-brand-600">{eyebrow}</p>}
      <h2 className="font-display text-3xl font-extrabold leading-tight text-ink-900 text-balance sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 leading-relaxed text-ink-500">{subtitle}</p>}
    </div>
  )
}
