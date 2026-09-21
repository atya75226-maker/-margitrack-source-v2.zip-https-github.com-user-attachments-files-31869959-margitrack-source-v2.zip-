/**
 * Configuration centrale du produit.
 * Changer le nom, le prix ou les offres se fait uniquement ici.
 */

/**
 * Adresse publique de référence.
 *
 * Un QR Code est imprimé, partagé, collé sur une vitrine : il doit pointer vers
 * une adresse qui ne bouge pas. S'il enregistrait l'adresse du navigateur au
 * moment de sa création, un code fabriqué depuis une préproduction resterait
 * coincé sur cette préproduction — et la session de l'utilisateur, liée à une
 * seule adresse, ne suivrait pas.
 */
const ORIGINE_PAR_DEFAUT = 'https://kartaa-eight.vercel.app'

/**
 * Une adresse locale dans un QR Code le rend inutilisable : le téléphone qui le
 * scanne cherche alors un serveur sur *son* appareil et affiche « site
 * introuvable ». On refuse donc localhost même s'il est configuré, plutôt que
 * de produire des codes morts.
 */
function origineUtilisable(valeur) {
  if (!valeur) return null
  try {
    const { protocol, hostname } = new URL(valeur)
    if (!/^https?:$/.test(protocol)) return null
    if (/^(localhost|127\.|0\.0\.0\.0|\[?::1)/i.test(hostname)) return null
    return valeur.replace(/\/+$/, '')
  } catch {
    return null
  }
}

const ORIGINE_PUBLIQUE = origineUtilisable(import.meta.env.VITE_PUBLIC_ORIGIN) || ORIGINE_PAR_DEFAUT

export const APP = {
  name: 'Kartaa',
  // Le positionnement du produit, tel qu'il est écrit en haut de la page
  // d'accueil : Kartaa crée une identité professionnelle numérique, et la carte
  // — numérique aujourd'hui, physique et NFC plus tard — n'est que le chemin
  // qui y mène.
  tagline: 'Votre identité professionnelle numérique.',
  publicOrigin: ORIGINE_PUBLIQUE,
  publicDomain: ORIGINE_PUBLIQUE.replace(/^https?:\/\//, ''),
  supportEmail: 'contact@kartaa.app',
}


/* ------------------------------------------------------------------- devise */

/**
 * Une seule devise pour toute l'application : le franc CFA.
 * Aucune conversion, aucun taux de change, aucune détection par pays — le prix
 * de référence et le prix affiché sont la même valeur.
 */
export const CURRENCY = {
  code: 'XOF',
  display: 'FCFA',
}

export const PRO_PRICE = 5000

/**
 * Page de paiement de l'abonnement Pro, chez le prestataire.
 *
 * Ouvrir cette page n'accorde rien : c'est la confirmation signée envoyée par
 * le prestataire à la fonction chariow-webhook qui active l'abonnement, jamais
 * un retour de navigateur. Le rattachement au compte se fait par l'adresse
 * e-mail du paiement — d'où la consigne affichée à côté du bouton.
 */
export const CHECKOUT_URL = 'https://ffnigord.mychariow.shop/prd_dv4ahcby'

/** Durée accordée par paiement, en jours. Doit rester alignée sur activate_pro(). */
export const PRO_PERIOD_DAYS = 30

/** « 5 000 FCFA » en français, « 5,000 FCFA » en anglais. Jamais de $, € ou £. */
export function formatPrice(amount = PRO_PRICE, language = 'fr') {
  const separator = language === 'en' ? ',' : ' '
  const grouped = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, separator)
  return `${grouped} ${CURRENCY.display}`
}

/* ------------------------------------------------------------------- offres */

export const PLANS = {
  free: {
    id: 'free',
    price: 0,
    limits: { cards: 1, templates: ['standard'] },
  },
  pro: {
    id: 'pro',
    price: PRO_PRICE,
    limits: {
      cards: Infinity,
      templates: ['standard', 'premium', 'vip'],
    },
  },
}

export const PLAN_ORDER = ['free', 'pro']

/**
 * Offre effective d'une personne.
 *
 * « Pro » ne suffit pas : un abonnement échu redevient gratuit. La base applique
 * exactement la même règle (plan_of, current_plan) — l'écran ne fait que
 * refléter ce que le serveur appliquera de toute façon.
 */
export function planOf(user) {
  if (user?.plan !== 'pro') return PLANS.free
  if (user.proUntil && new Date(user.proUntil).getTime() <= Date.now()) return PLANS.free
  return PLANS.pro
}

export function isPro(user) {
  return planOf(user).id === 'pro'
}

/** « free », « active » ou « expired » — ce que la page Mon abonnement affiche. */
export function subscriptionStatus(user) {
  if (user?.plan !== 'pro') return 'free'
  if (!user.proUntil) return 'active'
  return new Date(user.proUntil).getTime() > Date.now() ? 'active' : 'expired'
}

/**
 * Ce que l'abonnement Pro débloque, et ce que chaque option apporte.
 *
 * Une seule liste pour toute l'application : c'est elle que lisent les écrans
 * pour savoir s'il faut verrouiller, et c'est elle qui fournit la phrase
 * affichée quand on le fait. Disperser ces conditions dans les pages, c'est
 * garantir qu'elles finiront par se contredire.
 *
 * Ce qui est ici n'est qu'un guide d'affichage : la base refuse de son côté
 * (déclencheurs sur cards, plan_limits, contrôle du plan). Cacher un bouton ne
 * protège rien.
 */
export const PRO_CAPABILITIES = {
  multipleCards: {
    label: 'Plusieurs cartes',
    value: "Une carte personnelle, une carte entreprise, une par activité : chacune avec son mini-site et son QR Code.",
  },
  premiumTemplates: {
    label: 'Modèles Premium et VIP',
    value: "Des cartes qui ressemblent à de vraies cartes de visite, pas à un modèle par défaut.",
  },
  advancedDesign: {
    label: 'Personnalisation avancée',
    value: "Couleurs, typographies et mise en page : votre carte à vos codes, pas aux nôtres.",
  },
  proSocials: {
    label: 'Facebook, Instagram, Telegram et X',
    value: "Vos réseaux d'audience sur votre profil. Téléphone, WhatsApp, e-mail, TikTok, YouTube, LinkedIn, Snapchat et vos autres liens restent gratuits.",
  },
  companyInfo: {
    label: "Informations d'entreprise",
    value: "Nom de la structure, logo, adresse, site professionnel : ce qui fait une identité d'entreprise et non un simple contact.",
  },
  gallery: {
    label: 'Galerie photos',
    value: "Vos réalisations, vos produits, votre local : ce qui donne du crédit à une carte.",
  },
  multipleActivities: {
    label: 'Plusieurs activités',
    value: "Quand un seul métier ne suffit pas à vous décrire.",
  },
  advancedStats: {
    label: 'Statistiques avancées',
    value: "Qui appelle, qui écrit, quels réseaux sont ouverts : ce que devient votre carte une fois partagée.",
  },
  removeBranding: {
    label: 'Carte et profil sans filigrane',
    value: "La mention « Powered by Kartaa » disparaît du verso de votre carte et du bas de votre profil public.",
  },
}

/** Vrai si l'offre de la personne couvre cette fonctionnalité. */
export function can(user, capability) {
  if (!(capability in PRO_CAPABILITIES)) return true
  return isPro(user)
}

/* ------------------------------------------------- réseaux sociaux et liens */

/**
 * Chaque plateforme accepte autant de comptes que souhaité : la liste ci-dessous
 * décrit seulement comment présenter et valider une entrée.
 *
 * `pro: true` marque les réseaux inclus dans l'abonnement Kartaa Pro. Ce n'est
 * qu'un guide d'affichage : la base refuse de son côté, dans
 * set_card_social_links(), qui lit la même liste via pro_social_platforms().
 * Les deux listes doivent rester identiques.
 *
 * Les coordonnées de base — téléphone, WhatsApp, e-mail — n'en font jamais
 * partie : sans elles, une carte gratuite ne servirait à rien. TikTok, YouTube,
 * LinkedIn, Snapchat, les sites web et les autres liens restent gratuits eux
 * aussi.
 */
export const SOCIAL_NETWORKS = [
  { key: 'whatsapp',  label: 'WhatsApp',  kind: 'phone', color: '#25D366', placeholder: '+225 07 00 00 00 00', titlePlaceholder: 'Ligne professionnelle' },
  { key: 'facebook',  label: 'Facebook',  kind: 'url',   color: '#1877F2', placeholder: 'https://facebook.com/…', titlePlaceholder: 'Page de l’entreprise', pro: true },
  { key: 'instagram', label: 'Instagram', kind: 'url',   color: '#E4405F', placeholder: 'https://instagram.com/…', titlePlaceholder: 'Compte personnel', pro: true },
  { key: 'tiktok',    label: 'TikTok',    kind: 'url',   color: '#111111', placeholder: 'https://tiktok.com/@…', titlePlaceholder: 'Compte principal' },
  { key: 'youtube',   label: 'YouTube',   kind: 'url',   color: '#FF0000', placeholder: 'https://youtube.com/@…', titlePlaceholder: 'Ma chaîne principale' },
  { key: 'linkedin',  label: 'LinkedIn',  kind: 'url',   color: '#0A66C2', placeholder: 'https://linkedin.com/in/…', titlePlaceholder: 'Profil professionnel' },
  { key: 'x',         label: 'X',         kind: 'url',   color: '#111111', placeholder: 'https://x.com/…', titlePlaceholder: 'Compte principal', pro: true },
  { key: 'snapchat',  label: 'Snapchat',  kind: 'url',   color: '#FFFC00', placeholder: 'https://snapchat.com/add/…', titlePlaceholder: 'Compte personnel' },
  { key: 'telegram',  label: 'Telegram',  kind: 'url',   color: '#26A5E4', placeholder: 'https://t.me/…', titlePlaceholder: 'Canal public', pro: true },
  { key: 'website',   label: 'Sites web', kind: 'url',   color: '#6d28d9', placeholder: 'https://…', titlePlaceholder: 'Mon entreprise', namedFirst: true },
  { key: 'other',     label: 'Autres liens', kind: 'url', color: '#41486c', placeholder: 'https://…', titlePlaceholder: 'Mon catalogue PDF', namedFirst: true },
]

export const NETWORK_BY_KEY = Object.fromEntries(SOCIAL_NETWORKS.map((item) => [item.key, item]))

/** Les réseaux inclus dans Pro. Doit rester aligné sur pro_social_platforms() en base. */
export const PRO_SOCIAL_KEYS = SOCIAL_NETWORKS.filter((item) => item.pro).map((item) => item.key)

/** Vrai si cette plateforme demande un abonnement Pro à cette personne. */
export function socialLocked(user, platform) {
  return PRO_SOCIAL_KEYS.includes(platform) && !isPro(user)
}

/* ----------------------------------------------------------------- modèles */

/**
 * Les trois modèles de carte.
 *
 * Tous suivent la même règle : le nom Kartaa au recto, le QR Code au verso,
 * aucune information personnelle. Ils ne diffèrent que par la finition — le
 * dessin exact vit dans `components/card/CardArtwork.jsx`.
 *
 * `defaults` n'habille plus la carte : ce sont les couleurs et la typographie
 * proposées pour le mini-site public au moment où l'on choisit un modèle.
 */
export const TEMPLATES = [
  {
    id: 'standard',
    name: 'Carte Standard',
    description: 'Bleu nuit, nom blanc. Va droit au but.',
    pro: false,
    defaults: { primary: '#6d28d9', accent: '#f5b229', font: 'sans', layout: 'left' },
  },
  {
    id: 'premium',
    name: 'Carte Premium',
    description: 'Noir satiné, lettrage fin et espacé.',
    pro: true,
    defaults: { primary: '#5b21b6', accent: '#f5b229', font: 'display', layout: 'center' },
  },
  {
    id: 'vip',
    name: 'Carte VIP',
    description: 'Noir profond, liseré et nom dorés.',
    pro: true,
    defaults: { primary: '#141728', accent: '#f5b229', font: 'serif', layout: 'left' },
  },
]

export const PALETTES = [
  { name: 'Violet', primary: '#6d28d9', accent: '#f5b229' },
  { name: 'Nuit', primary: '#141728', accent: '#f5b229' },
  { name: 'Émeraude', primary: '#0f766e', accent: '#facc15' },
  { name: 'Océan', primary: '#1d4ed8', accent: '#38bdf8' },
  { name: 'Terracotta', primary: '#b4460f', accent: '#fbbf24' },
  { name: 'Bordeaux', primary: '#881337', accent: '#fda4af' },
]

export const FONTS = [
  { id: 'sans', label: 'Moderne', className: 'font-sans' },
  { id: 'display', label: 'Affirmé', className: 'font-display' },
  { id: 'serif', label: 'Élégant', className: 'font-serif' },
]

/** Fonctionnalités préparées mais non branchées (voir README). */
export const FEATURE_FLAGS = {
  payments: true,          // Chariow : page de paiement + Pulse signé (chariow-webhook)
  physicalPrinting: false, // impression et livraison de cartes physiques
  domainRegistrar: false,  // vérification réelle d'un domaine
  nativeBiometrics: true,  // WebAuthn si l'appareil le propose
  nfc: true,               // Web NFC : écriture sur Chrome/Android, lecture universelle une fois la puce programmée
}
