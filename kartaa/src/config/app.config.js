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
  tagline: 'Votre identité. Votre carte. Votre QR Code.',
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
    limits: { cards: 1, vaults: 1, storageMb: 200, templates: ['standard'] },
  },
  pro: {
    id: 'pro',
    price: PRO_PRICE,
    limits: {
      cards: Infinity,
      vaults: Infinity,
      storageMb: 20000,
      templates: ['standard', 'premium', 'vip'],
    },
  },
}

export const PLAN_ORDER = ['free', 'pro']

export function planOf(user) {
  return PLANS[user?.plan] || PLANS.free
}

export function isPro(user) {
  return planOf(user).id === 'pro'
}

/** Fonctionnalités réservées à l'abonnement Pro. */
export function can(user, capability) {
  const pro = isPro(user)
  switch (capability) {
    case 'customDomain':
    case 'advancedStats':
    case 'removeBranding':
    case 'premiumTemplates':
    case 'multipleCards':
    case 'multipleVaults':
      return pro
    default:
      return true
  }
}

/* ------------------------------------------------- réseaux sociaux et liens */

/**
 * Chaque plateforme accepte autant de comptes que souhaité : la liste ci-dessous
 * décrit seulement comment présenter et valider une entrée.
 */
export const SOCIAL_NETWORKS = [
  { key: 'whatsapp',  label: 'WhatsApp',  kind: 'phone', color: '#25D366', placeholder: '+225 07 00 00 00 00', titlePlaceholder: 'Ligne professionnelle' },
  { key: 'facebook',  label: 'Facebook',  kind: 'url',   color: '#1877F2', placeholder: 'https://facebook.com/…', titlePlaceholder: 'Page de l’entreprise' },
  { key: 'instagram', label: 'Instagram', kind: 'url',   color: '#E4405F', placeholder: 'https://instagram.com/…', titlePlaceholder: 'Compte personnel' },
  { key: 'tiktok',    label: 'TikTok',    kind: 'url',   color: '#111111', placeholder: 'https://tiktok.com/@…', titlePlaceholder: 'Compte principal' },
  { key: 'youtube',   label: 'YouTube',   kind: 'url',   color: '#FF0000', placeholder: 'https://youtube.com/@…', titlePlaceholder: 'Ma chaîne principale' },
  { key: 'linkedin',  label: 'LinkedIn',  kind: 'url',   color: '#0A66C2', placeholder: 'https://linkedin.com/in/…', titlePlaceholder: 'Profil professionnel' },
  { key: 'x',         label: 'X',         kind: 'url',   color: '#111111', placeholder: 'https://x.com/…', titlePlaceholder: 'Compte principal' },
  { key: 'snapchat',  label: 'Snapchat',  kind: 'url',   color: '#FFFC00', placeholder: 'https://snapchat.com/add/…', titlePlaceholder: 'Compte personnel' },
  { key: 'telegram',  label: 'Telegram',  kind: 'url',   color: '#26A5E4', placeholder: 'https://t.me/…', titlePlaceholder: 'Canal public' },
  { key: 'website',   label: 'Sites web', kind: 'url',   color: '#6d28d9', placeholder: 'https://…', titlePlaceholder: 'Mon entreprise', namedFirst: true },
  { key: 'other',     label: 'Autres liens', kind: 'url', color: '#41486c', placeholder: 'https://…', titlePlaceholder: 'Mon catalogue PDF', namedFirst: true },
]

export const NETWORK_BY_KEY = Object.fromEntries(SOCIAL_NETWORKS.map((item) => [item.key, item]))

/* ----------------------------------------------------------------- modèles */

export const TEMPLATES = [
  {
    id: 'standard',
    name: 'Carte Standard',
    description: 'Design clair et professionnel. Va droit au but.',
    pro: false,
    defaults: { primary: '#6d28d9', accent: '#f5b229', font: 'sans', layout: 'left' },
  },
  {
    id: 'premium',
    name: 'Carte Premium',
    description: 'Dégradé élégant, plus de personnalisation.',
    pro: true,
    defaults: { primary: '#5b21b6', accent: '#f5b229', font: 'display', layout: 'center' },
  },
  {
    id: 'vip',
    name: 'Carte VIP',
    description: 'Finition sombre et dorée, haut de gamme.',
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
  payments: false,         // prestataire compatible FCFA à connecter
  physicalPrinting: false, // impression et livraison de cartes physiques
  domainRegistrar: false,  // vérification réelle d'un domaine
  nativeBiometrics: true,  // WebAuthn si l'appareil le propose
}
