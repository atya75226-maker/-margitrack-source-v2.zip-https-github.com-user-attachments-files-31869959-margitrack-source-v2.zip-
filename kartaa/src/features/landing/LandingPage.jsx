import { useState } from 'react'
import { Link } from 'react-router-dom'
import { APP, PRO_PRICE, SOCIAL_NETWORKS } from '../../config/app.config'
import { Icon, Logo, SocialIcon } from '../../components/ui/Icons'
import { Button } from '../../components/ui'
import { CardArtwork, CardScaler } from '../../components/card/CardArtwork'
import { useCardAssets, useQrVectoriel } from '../../hooks/useCardAssets'
import ProfileView from '../public/ProfileView'
import { DEMO_CARDS } from './demoCards'
import { useAuth } from '../../state/AuthContext'
import { useTranslation, LANGUAGES } from '../../i18n'
import { InstallButton, useModeInstallation } from '../../components/InstallApp'

/**
 * Page d'accueil publique.
 *
 * Règle qui gouverne tout ce fichier : elle ne présente que ce que
 * l'application fait réellement aujourd'hui. Pas de NFC, pas d'impression de
 * cartes, pas de domaine personnalisé — ces chantiers existent dans le code
 * mais ne sont pas branchés (voir FEATURE_FLAGS), donc ils ne sont pas promis
 * ici. Une vitrine qui vend ce qui n'existe pas se paye au premier client.
 *
 * Le profil montré dans le téléphone n'est pas une image : c'est `ProfileView`,
 * le composant qui affiche les vrais mini-sites, nourri de données d'exemple
 * clairement annoncées comme telles.
 */

/* --------------------------------------------- ce que Kartaa fait vraiment */

const SOLUTIONS = [
  { icon: 'globe', tone: 'brand', title: 'Profil professionnel', text: 'Votre vitrine en ligne, à votre adresse' },
  { icon: 'qr', tone: 'sky', title: 'QR Code personnel', text: 'Il ouvre votre profil, et reste valable' },
  { icon: 'card', tone: 'violet', title: 'Carte à imprimer', text: 'PNG, JPG ou PDF, recto et verso' },
  { icon: 'scan', tone: 'amber', title: 'Scanner universel', text: 'Tous les QR Codes, un seul outil' },
  { icon: 'share', tone: 'rose', title: 'Réseaux et liens', text: 'Plusieurs comptes, plusieurs liens' },
  { icon: 'download', tone: 'emerald', title: 'Installable et hors connexion', text: 'Sur votre écran d’accueil, même sans réseau' },
]

const ETAPES = [
  {
    icon: 'user',
    tone: 'brand',
    titre: 'Créez votre profil',
    texte: 'Renseignez vos informations professionnelles en quelques minutes.',
  },
  {
    icon: 'qr',
    tone: 'violet',
    titre: 'Obtenez votre QR Code',
    texte: 'Votre carte est générée automatiquement, avec un QR Code unique.',
  },
  {
    icon: 'share',
    tone: 'emerald',
    titre: 'Partagez facilement',
    texte: 'Montrez votre QR Code, partagez le lien, ou téléchargez votre carte.',
  },
  {
    icon: 'eye',
    tone: 'amber',
    titre: 'Soyez trouvé',
    texte: 'Vos clients ouvrent votre profil complet, sans compte et sans application.',
  },
]

const PRO_INCLUS = [
  'Plusieurs cartes professionnelles',
  'Modèles Premium et VIP',
  'Galerie photos sur votre profil',
  'Plusieurs entreprises et activités',
  'Couleurs et typographie de votre profil',
  'Statistiques détaillées des interactions',
]

const GRATUIT_INCLUS = [
  'Une carte et son QR Code',
  'Votre profil public complet',
  'Appel, WhatsApp, e-mail, fiche contact',
  'Réseaux et liens sans limite',
  'Scanner de QR Codes',
  'Application installable, mode hors connexion',
]

const FAQ = [
  {
    q: 'Faut-il installer une application ?',
    a: "Non. Kartaa fonctionne dans le navigateur, sur téléphone comme sur ordinateur. La personne qui scanne votre QR Code n'a rien à installer non plus. Vous pouvez tout de même poser Kartaa sur votre écran d'accueil si vous le souhaitez.",
  },
  {
    q: 'Que contient exactement le QR Code ?',
    a: "Uniquement l'adresse de votre profil public. Ni votre numéro, ni vos fichiers n'y sont inscrits : vous pouvez modifier vos informations sans réimprimer quoi que ce soit.",
  },
  {
    q: 'Que voit la personne qui scanne ?',
    a: "Ce que vous avez renseigné, et rien d'autre. Un champ laissé vide n'apparaît pas : pas de bouton « Appeler » sans numéro, pas d'icône de réseau que vous n'avez pas donné.",
  },
  {
    q: 'Kartaa fonctionne-t-il sans connexion ?',
    a: "L'application s'ouvre et montre vos cartes et vos QR Codes sans réseau, et rouvre les profils déjà consultés sur l'appareil. Un profil jamais ouvert ici a besoin d'une connexion la première fois — nous préférons le dire.",
  },
]

/** Teintes des pastilles, pour que chaque bloc garde la sienne. */
const TONS = {
  brand: 'bg-brand-50 text-brand-600',
  violet: 'bg-violet-50 text-violet-600',
  sky: 'bg-sky-50 text-sky-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth()
  return (
    <div className="bg-white">
      <Entete isAuthenticated={isAuthenticated} />
      <Hero />
      <Fonctionnement />
      <Solution />
      <Profil />
      <Reseaux />
      <Pro isAuthenticated={isAuthenticated} />
      <Questions />
      <Installation />
      <Pied />
    </div>
  )
}

/* ----------------------------------------------------------------- en-tête */

function Entete({ isAuthenticated }) {
  const [open, setOpen] = useState(false)
  const { language, setLanguage } = useTranslation()
  const liens = [
    { href: '#accueil', label: 'Accueil' },
    { href: '#fonctionnalites', label: 'Fonctionnalités' },
    { href: '#tarifs', label: 'Tarifs' },
    { href: '#faq', label: 'FAQ' },
  ]
  const suivante = LANGUAGES.find((item) => item.id !== language) || LANGUAGES[0]

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/85 backdrop-blur-xl">
      <div className="container-app flex items-center justify-between gap-6 py-3.5">
        <Link to="/" className="shrink-0">
          <Logo tone="light" />
        </Link>
        <nav className="hidden items-center gap-8 lg:flex">
          {liens.map((lien) => (
            <a key={lien.href} href={lien.href} className="text-sm font-semibold text-white/70 transition-colors hover:text-white">
              {lien.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {/* Le choix de langue existe réellement dans l'application : il est
              ici pour qu'on n'ait pas à créer un compte pour le trouver. */}
          <button
            type="button"
            onClick={() => setLanguage(suivante.id)}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            title={`Passer en ${suivante.label}`}
          >
            {language.toUpperCase()} <Icon name="chevronDown" size={14} />
          </button>
          {isAuthenticated ? (
            <Button as={Link} to="/app" variant="gold" size="sm" iconRight="arrowRight">
              Mon tableau de bord
            </Button>
          ) : (
            <>
              <Button as={Link} to="/connexion" variant="ghost" size="sm" className="text-white/80 hover:bg-white/10 hover:text-white">
                Se connecter
              </Button>
              <Button as={Link} to="/inscription" size="sm" className="bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-500 hover:to-brand-400">
                Créer mon compte
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
            {liens.map((lien) => (
              <a key={lien.href} href={lien.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10">
                {lien.label}
              </a>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button as={Link} to="/connexion" variant="outline" full size="sm" className="border-white/20 bg-transparent text-white hover:bg-white/10">
              Se connecter
            </Button>
            <Button as={Link} to="/inscription" full size="sm" className="bg-gradient-to-r from-brand-600 to-brand-500 text-white">
              Créer mon compte
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}

/* -------------------------------------------------------------------- hero */

function Hero() {
  const exemple = DEMO_CARDS[0]
  // Ce QR ouvre le site de Kartaa, pas un profil inventé : celui qui le scanne
  // depuis une capture d'écran arrive quelque part de réel.
  const qr = useQrVectoriel(APP.publicOrigin)

  return (
    <section id="accueil" className="relative overflow-hidden bg-ink-950 pb-20 pt-12 text-white sm:pt-16">
      <div className="mesh absolute inset-0 opacity-90" />
      <div className="grain absolute inset-0 opacity-30" />
      <div className="container-app relative grid items-center gap-12 lg:grid-cols-[1fr,1.05fr]">
        <div className="min-w-0 animate-fade-up">
          <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold">
            <Icon name="sparkles" size={13} className="text-gold-400" />
            La carte de visite numérique nouvelle génération
          </span>
          <h1 className="font-display text-[2.5rem] font-extrabold leading-[1.08] tracking-tight text-balance sm:text-[3.4rem]">
            Votre identité professionnelle numérique,
            <br />
            <span className="bg-gradient-to-r from-brand-400 to-sky-400 bg-clip-text text-transparent">en un seul QR.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[1.05rem] leading-relaxed text-white/70">
            Créez votre profil professionnel, partagez vos <strong className="font-bold text-white">coordonnées</strong> et
            permettez à vos clients de vous retrouver facilement.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button
              as={Link}
              to="/inscription"
              size="lg"
              iconRight="arrowRight"
              className="whitespace-nowrap bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-500 hover:to-brand-400"
            >
              Commencer gratuitement
            </Button>
            {/* « Voir la démo » ouvre la démonstration réelle, plus bas sur
                cette page — pas une vidéo qui n'existe pas. */}
            <Button
              as="a"
              href="#profil"
              size="lg"
              variant="outline"
              icon="eye"
              className="whitespace-nowrap border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              Voir la démo
            </Button>
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-white/60">
            {[
              ['download', 'Sans installation'],
              ['globe', 'Accessible partout'],
              ['shield', 'Vos données protégées'],
            ].map(([icone, texte]) => (
              <span key={texte} className="flex items-center gap-2">
                <Icon name={icone} size={16} className="text-brand-400" />
                {texte}
              </span>
            ))}
          </div>
        </div>

        {/* Le produit réel : le profil dans un téléphone, et les deux faces de la carte. */}
        <div className="relative min-w-0 animate-fade-up [animation-delay:120ms]">
          <div className="absolute -inset-10 rounded-[3rem] bg-brand-500/10 blur-3xl" />
          <div className="relative flex items-center justify-center gap-6">
            <Telephone card={exemple} largeur={250} hauteur={510} />
            <div className="hidden w-[190px] shrink-0 space-y-4 sm:block">
              <div className="rotate-[6deg] overflow-hidden rounded-2xl shadow-card transition-transform duration-500 hover:rotate-0">
                <CardScaler maxWidth={190}>
                  <CardArtwork card={exemple} side="front" />
                </CardScaler>
              </div>
              <div className="rotate-[-4deg] overflow-hidden rounded-2xl shadow-card transition-transform duration-500 hover:rotate-0">
                <CardScaler maxWidth={190}>
                  <CardArtwork card={exemple} side="back" qr={qr} />
                </CardScaler>
              </div>
              <p className="pt-1 text-center text-xs font-semibold leading-relaxed text-white/50">
                Une carte minimaliste,
                <br />
                un accès complet.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Un téléphone qui montre le VRAI profil.
 *
 * Pas une imitation dessinée à la main : `ProfileView` est le composant du
 * mini-site public, simplement mis à l'échelle. Si le profil évolue, cette
 * vitrine évolue avec lui — elle ne peut pas se mettre à mentir en vieillissant.
 */
function Telephone({ card, largeur = 250, hauteur = 500, className = '' }) {
  const assets = useCardAssets(card, '')
  const base = 420
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-[2.2rem] border-[7px] border-ink-900 bg-white shadow-card ${className}`}
      style={{ width: largeur, height: hauteur }}
    >
      <div style={{ width: base, transform: `scale(${largeur / base})`, transformOrigin: 'top left' }}>
        {/* `actif={false}` : dans une vitrine, les liens ne mènent nulle part. */}
        <ProfileView card={card} assets={{ ...assets, qr: null }} actif={false} publicHref="" onVcard={() => {}} />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- fonctionnement */

function Fonctionnement() {
  const exemple = DEMO_CARDS[0]
  const qr = useQrVectoriel(APP.publicOrigin)
  const visuels = [<VisuelFormulaire key="1" />, <VisuelCarte key="2" card={exemple} qr={qr} />, <VisuelPartage key="3" />, <VisuelProfil key="4" card={exemple} />]

  return (
    <section className="bg-ink-50 py-20 sm:py-24">
      <div className="container-app">
        <h2 className="mb-14 text-center font-display text-3xl font-extrabold text-ink-900 sm:text-4xl">
          Comment ça marche ?
        </h2>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {ETAPES.map((etape, index) => (
            <div key={etape.titre} className="flex min-w-0 flex-col">
              <span className={`mb-5 grid h-14 w-14 place-items-center rounded-2xl ${TONS[etape.tone]}`}>
                <Icon name={etape.icon} size={24} />
              </span>
              <h3 className="font-display text-base font-bold text-ink-900">
                {index + 1}. {etape.titre}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{etape.texte}</p>
              <div className="mt-6 flex flex-1 items-end">{visuels[index]}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Les champs de la première étape de l'assistant, tels qu'ils y figurent. */
function VisuelFormulaire() {
  return (
    <div className="w-full rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
      <p className="mb-3 text-xs font-extrabold text-ink-900">Informations professionnelles</p>
      {[['Nom complet', 'Awa Traoré'], ['Profession', 'Consultante en marketing digital'], ['Entreprise', 'Studio Akwaba']].map(([label, valeur]) => (
        <div key={label} className="mb-2.5 last:mb-0">
          <p className="mb-1 text-[0.65rem] font-bold text-ink-400">{label}</p>
          <p className="truncate rounded-xl border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-700">{valeur}</p>
        </div>
      ))}
    </div>
  )
}

function VisuelCarte({ card, qr }) {
  return (
    <div className="w-full min-w-0 rotate-[-5deg] overflow-hidden rounded-2xl shadow-card transition-transform duration-500 hover:rotate-0">
      <CardScaler>
        <CardArtwork card={card} side="back" qr={qr} />
      </CardScaler>
    </div>
  )
}

/** Les trois partages réellement proposés par l'application. */
function VisuelPartage() {
  const actions = [
    { icon: 'whatsapp', label: 'WhatsApp', classe: 'bg-emerald-50 text-emerald-600' },
    { icon: 'link', label: 'Partager le lien', classe: 'bg-brand-50 text-brand-600' },
    { icon: 'download', label: 'Télécharger la carte', classe: 'bg-rose-50 text-rose-600' },
  ]
  return (
    <div className="w-full space-y-2">
      {actions.map((action) => (
        <div key={action.label} className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-soft">
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${action.classe}`}>
            <Icon name={action.icon} size={17} />
          </span>
          <span className="text-sm font-bold text-ink-800">{action.label}</span>
        </div>
      ))}
    </div>
  )
}

function VisuelProfil({ card }) {
  return (
    <div className="mx-auto">
      <Telephone card={card} largeur={190} hauteur={260} />
    </div>
  )
}

/* --------------------------------------------------------------- solution */

function Solution() {
  return (
    <section id="fonctionnalites" className="container-app py-20 sm:py-24">
      <div className="grid gap-12 lg:grid-cols-[1fr,1.2fr] lg:items-center">
        <div>
          <h2 className="font-display text-3xl font-extrabold leading-tight text-ink-900 text-balance sm:text-4xl">
            Une solution complète pour les professionnels d'aujourd'hui.
          </h2>
          <p className="mt-5 leading-relaxed text-ink-500">
            Kartaa vous offre bien plus qu'une simple carte de visite : c'est votre présence professionnelle en ligne,
            toujours à portée de main. Tout ce qui est listé ici fonctionne aujourd'hui — ce qui n'est pas encore
            branché n'a pas sa place sur cette page.
          </p>
          <Button as="a" href="#profil" variant="outline" className="mt-7" iconRight="arrowRight">
            Voir un profil en entier
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {SOLUTIONS.map((item) => (
            <div key={item.title} className="flex items-start gap-3.5 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${TONS[item.tone]}`}>
                <Icon name={item.icon} size={20} />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-sm font-bold text-ink-900">{item.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{item.text}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ profil */

function Profil() {
  const [actif, setActif] = useState(0)
  const card = DEMO_CARDS[actif]
  return (
    <section id="profil" className="bg-ink-50 py-20 sm:py-24">
      <div className="container-app">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[.2em] text-brand-600">Le profil</p>
          <h2 className="font-display text-3xl font-extrabold leading-tight text-ink-900 text-balance sm:text-4xl">
            Voilà ce que voit la personne qui vous scanne.
          </h2>
          <p className="mt-4 leading-relaxed text-ink-500">
            Ce téléphone affiche le composant réel de Kartaa, pas une image. Seules les informations montrées sont des
            exemples.
          </p>
        </div>
        <div className="grid items-start gap-10 lg:grid-cols-[auto,1fr]">
          <div className="mx-auto">
            <Telephone card={card} largeur={320} hauteur={640} />
            <p className="mt-3 max-w-[320px] text-center text-xs font-semibold text-ink-400">
              Exemple — {card.profile.firstName} {card.profile.lastName}, données de démonstration
            </p>
          </div>
          <div>
            <div className="mb-6 flex flex-wrap gap-2">
              {DEMO_CARDS.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActif(index)}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-all ${
                    actif === index ? 'bg-ink-900 text-white shadow-soft' : 'bg-white text-ink-500 hover:text-ink-900'
                  }`}
                >
                  {item.profile.profession}
                </button>
              ))}
            </div>
            <ul className="space-y-3">
              {[
                ['user', 'Votre identité', 'Photo, nom, métier, entreprise, ville — et votre présentation en quelques lignes.'],
                ['phone', 'Vos moyens de contact', 'Appeler, WhatsApp, e-mail : seulement ceux que vous avez renseignés.'],
                ['share', 'Vos réseaux', 'Une rangée d’icônes, uniquement pour les comptes que vous avez ajoutés.'],
                ['briefcase', 'Vos services', 'Ce que vous proposez, avec un prix si vous souhaitez l’afficher.'],
                ['download', 'Votre fiche contact', 'Un appui, et vous êtes enregistré dans le répertoire du téléphone.'],
              ].map(([icon, titre, texte]) => (
                <li key={titre} className="flex items-start gap-3.5 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon name={icon} size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-sm font-bold text-ink-900">{titre}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-ink-500">{texte}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 flex items-start gap-2 text-sm leading-relaxed text-ink-500">
              <Icon name="check" size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              Un champ vide n'apparaît pas. Un profil qui ne renseigne que son nom et son WhatsApp reste une page nette,
              sans trou ni bouton mort.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- réseaux */

function Reseaux() {
  return (
    <section className="container-app py-20 sm:py-24">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-[.2em] text-brand-600">Vos réseaux</p>
        <h2 className="font-display text-3xl font-extrabold leading-tight text-ink-900 text-balance sm:text-4xl">
          Tous vos comptes au même endroit.
        </h2>
        <p className="mt-4 leading-relaxed text-ink-500">
          Une rangée d'icônes sur votre profil, dans l'ordre que vous choisissez. Vous pouvez même ajouter plusieurs
          comptes sur une même plateforme — un compte personnel et un compte d'entreprise, par exemple.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {SOCIAL_NETWORKS.map((network) => (
          <span key={network.key} className="flex items-center gap-2 rounded-2xl border border-ink-100 bg-white px-4 py-2.5 shadow-soft">
            <span className="grid h-8 w-8 place-items-center rounded-xl text-white" style={{ background: network.color }}>
              <SocialIcon network={network.key} size={16} />
            </span>
            <span className="text-sm font-semibold text-ink-700">{network.label}</span>
          </span>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-ink-400">
        Seuls les comptes que vous renseignez apparaissent sur votre profil. Les autres n'existent pas pour vos visiteurs.
      </p>
    </section>
  )
}

/* --------------------------------------------------------------------- Pro */

function Pro({ isAuthenticated }) {
  return (
    <section id="tarifs" className="relative overflow-hidden bg-ink-950 py-20 text-white sm:py-24">
      <div className="mesh absolute inset-0 opacity-60" />
      <div className="container-app relative grid gap-10 lg:grid-cols-[1fr,1.1fr] lg:items-center">
        <div>
          <h2 className="font-display text-3xl font-extrabold leading-tight text-balance sm:text-4xl">
            Passez à la vitesse supérieure.
          </h2>
          <p className="mt-5 leading-relaxed text-white/65">
            Kartaa est gratuit, et le reste : une carte, son QR Code, votre profil complet, vos réseaux, le scanner et le
            mode hors connexion. Pro s'adresse à ceux qui ont besoin de plusieurs cartes et de finitions plus soignées.
          </p>
          <ul className="mt-7 space-y-2.5">
            {GRATUIT_INCLUS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-white/70">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                {item}
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-bold text-white/60">Gratuit</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-5 sm:grid-cols-[1fr,1fr] sm:items-start">
          <div className="rounded-3xl border border-white/15 bg-white/[0.06] p-7 backdrop-blur">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-gold-400/15 px-3 py-1.5 text-xs font-extrabold text-gold-300">
              <Icon name="crown" size={13} /> {APP.name} Pro
            </span>
            <p className="flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-extrabold">
                {PRO_PRICE.toLocaleString('fr-FR').replace(/ | /g, ' ')}
              </span>
              <span className="text-sm font-semibold text-white/60">FCFA / mois</span>
            </p>
            {/* Le vrai parcours : la page d'abonnement du compte, qui ouvre
                ensuite la page de paiement du prestataire. Rien n'est débloqué
                depuis cette vitrine. */}
            <Button
              as={Link}
              to={isAuthenticated ? '/app/abonnement' : '/inscription'}
              full
              className="mt-6 bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-500 hover:to-brand-400"
            >
              {isAuthenticated ? 'Voir mon abonnement' : 'Passer à Pro'}
            </Button>
            <p className="mt-3 text-center text-[0.7rem] leading-relaxed text-white/45">
              Paiement chez notre prestataire, avec l'adresse e-mail de votre compte.
            </p>
          </div>
          <ul className="space-y-2.5">
            {PRO_INCLUS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-white/80">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-gold-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- questions */

function Questions() {
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" className="container-app max-w-3xl py-20 sm:py-24">
      <h2 className="mb-10 text-center font-display text-3xl font-extrabold text-ink-900 sm:text-4xl">
        Ce qu'on nous demande le plus.
      </h2>
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
      <div className="mt-12 rounded-[2rem] bg-ink-950 px-8 py-12 text-center text-white">
        <h3 className="mx-auto max-w-xl font-display text-2xl font-extrabold leading-tight text-balance sm:text-3xl">
          Créez votre identité professionnelle numérique.
        </h3>
        <p className="mx-auto mt-3 max-w-lg text-sm text-white/70">
          Quelques minutes suffisent. Votre profil est en ligne et votre QR Code prêt immédiatement.
        </p>
        <Button
          as={Link}
          to="/inscription"
          size="lg"
          iconRight="arrowRight"
          className="mt-7 bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-500 hover:to-brand-400"
        >
          Commencer gratuitement
        </Button>
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
function Installation() {
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
            Depuis votre navigateur, sans magasin d'applications. Elle s'ouvre en plein écran et garde votre session.
          </p>
          <div className="mt-6">
            <InstallButton />
          </div>
        </div>
      </div>
    </section>
  )
}

function Pied() {
  const liens = [
    { href: '#accueil', label: 'Accueil' },
    { href: '#fonctionnalites', label: 'Fonctionnalités' },
    { href: '#tarifs', label: 'Tarifs' },
    { href: '#faq', label: 'FAQ' },
  ]
  return (
    <footer className="bg-ink-950 py-10 text-white">
      <div className="container-app flex flex-col items-center gap-7">
        <div className="flex w-full flex-col items-center justify-between gap-6 sm:flex-row">
          <Logo tone="light" size={30} />
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {liens.map((lien) => (
              <a key={lien.href} href={lien.href} className="text-sm font-semibold text-white/60 transition-colors hover:text-white">
                {lien.label}
              </a>
            ))}
            <Link to="/connexion" className="text-sm font-semibold text-white/60 transition-colors hover:text-white">
              Se connecter
            </Link>
            <Link to="/inscription" className="text-sm font-semibold text-brand-400 transition-colors hover:text-brand-300">
              Créer mon compte
            </Link>
          </nav>
        </div>
        <p className="max-w-2xl text-center text-xs leading-relaxed text-white/35">
          L'impression de cartes physiques et l'enregistrement d'un nom de domaine ne sont pas encore branchés : ces
          écrans existent dans l'application, mais nous ne les présentons pas comme disponibles.
        </p>
        <p className="text-xs text-white/30">© {new Date().getFullYear()} {APP.name}</p>
      </div>
    </footer>
  )
}
