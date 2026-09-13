/**
 * Configuration centrale du produit.
 * Changer le nom, le domaine ou les offres se fait uniquement ici.
 */

export const APP = {
  name: 'Kartaa',
  tagline: 'Votre identité. Votre carte. Votre QR Code.',
  // Domaine public utilisé pour composer les liens des mini-sites : kartaa.app/jean
  publicDomain: typeof window !== 'undefined' ? window.location.host : 'kartaa.app',
  supportEmail: 'contact@kartaa.app',
}

export const PLANS = {
  free: {
    id: 'free',
    name: 'Gratuit',
    price: '0',
    period: 'pour toujours',
    tagline: 'Pour démarrer en 3 minutes.',
    limits: { cards: 1, vaults: 1, storageMb: 200, templates: ['standard'] },
    features: [
      '1 carte de visite numérique',
      'QR Code personnel',
      'Mini-site public',
      'Designs standard',
      '1 Coffre Sécurité — 200 Mo',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: '9 900',
    currency: 'FCFA',
    period: '/ mois',
    tagline: 'Pour les indépendants et les pros.',
    highlight: true,
    limits: { cards: 5, vaults: 5, storageMb: 5000, templates: ['standard', 'premium'] },
    features: [
      "Jusqu'à 5 cartes",
      'Designs Premium + personnalisation avancée',
      'Statistiques de scans détaillées',
      'Entreprises, services et galerie illimités',
      'Nom de domaine personnalisé',
      '5 Go de Coffre Sécurité',
    ],
  },
  vip: {
    id: 'vip',
    name: 'VIP',
    price: '24 900',
    currency: 'FCFA',
    period: '/ mois',
    tagline: 'Pour les marques et les équipes.',
    limits: { cards: Infinity, vaults: Infinity, storageMb: 20000, templates: ['standard', 'premium', 'vip'] },
    features: [
      'Cartes et mini-sites illimités',
      'Design VIP haut de gamme',
      'Domaine personnalisé inclus',
      'Suppression du branding Kartaa',
      '20 Go de Coffre Sécurité',
      'Support prioritaire',
    ],
  },
}

export const PLAN_ORDER = ['free', 'premium', 'vip']

export function planOf(user) {
  return PLANS[user?.plan] || PLANS.free
}

export function can(user, capability) {
  const plan = planOf(user)
  switch (capability) {
    case 'customDomain': return plan.id !== 'free'
    case 'advancedStats': return plan.id !== 'free'
    case 'removeBranding': return plan.id === 'vip'
    default: return true
  }
}

export const SOCIAL_NETWORKS = [
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '+225 07 00 00 00 00', kind: 'phone', color: '#25D366' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/…', kind: 'url', color: '#1877F2' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/…', kind: 'url', color: '#E4405F' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@…', kind: 'url', color: '#111111' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/…', kind: 'url', color: '#0A66C2' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@…', kind: 'url', color: '#FF0000' },
  { key: 'x', label: 'X', placeholder: 'https://x.com/…', kind: 'url', color: '#111111' },
  { key: 'website', label: 'Site web', placeholder: 'https://…', kind: 'url', color: '#6d28d9' },
]

export const TEMPLATES = [
  {
    id: 'standard',
    name: 'Carte Standard',
    description: 'Design clair et professionnel. Va droit au but.',
    plan: 'free',
    defaults: { primary: '#6d28d9', accent: '#f5b229', font: 'sans', layout: 'left' },
  },
  {
    id: 'premium',
    name: 'Carte Premium',
    description: 'Dégradé élégant, plus de personnalisation.',
    plan: 'premium',
    defaults: { primary: '#5b21b6', accent: '#f5b229', font: 'display', layout: 'center' },
  },
  {
    id: 'vip',
    name: 'Carte VIP',
    description: 'Finition sombre et dorée, haut de gamme.',
    plan: 'vip',
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
  payments: false,        // intégration d'un PSP (Stripe / Wave / Orange Money…)
  physicalPrinting: false,// impression et livraison de cartes physiques
  domainRegistrar: false, // connexion réelle à un registrar
  nativeBiometrics: true, // WebAuthn si le navigateur/appareil le supporte
}
