import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { formatPrice, PRO_PRICE } from '../config/app.config'

/**
 * Langue de l'interface : français ou anglais.
 *
 * La langue est indépendante de la devise — le prix reste en FCFA dans les deux
 * cas, sans conversion. Elle est détectée d'après le navigateur au premier
 * passage, puis suit le choix de l'utilisateur.
 *
 * Cette première version traduit le parcours d'abonnement ; le reste de
 * l'interface est en français, et se traduira en complétant ces dictionnaires.
 */

const STORAGE_KEY = 'kartaa.language'

const DICTIONARY = {
  fr: {
    'lang.name': 'Français',
    'lang.switch': 'Langue',

    'plan.free': 'Gratuit',
    'plan.pro': 'Pro',
    'plan.perMonth': '/ mois',

    'sub.title': 'Mon abonnement',
    'sub.upgradeTitle': 'Passez à Pro',
    'sub.upgradeIntro': 'Débloquez les fonctionnalités professionnelles de votre identité numérique.',
    'sub.cta': 'Passer à Pro',
    'sub.current': 'Votre offre actuelle',
    'sub.currentFree': 'Vous êtes sur l’offre Gratuit.',
    'sub.currentPro': 'Vous êtes abonné à Pro.',
    'sub.freeTitle': 'Ce que l’offre Gratuit vous donne déjà',
    'sub.manage': 'Gérer mon abonnement',
    'sub.cancel': 'Revenir à l’offre Gratuit',
    'sub.paymentPending': 'Paiement bientôt disponible',
    'sub.paymentNote':
      'Aucun prestataire de paiement n’est encore connecté. L’abonnement s’active ici en mode démonstration, et le montant transmis au futur système sera de 5 000 FCFA par mois.',
    'sub.activate': 'Activer Pro (démonstration)',
    'sub.activated': 'Abonnement Pro activé.',
    'sub.reverted': 'Retour à l’offre Gratuit.',

    'sub.f1': 'Cartes Premium et VIP',
    'sub.f2': 'Plusieurs cartes',
    'sub.f3': 'Mini-site avancé',
    'sub.f4': 'Domaine personnalisé',
    'sub.f5': 'Statistiques avancées',
    'sub.f6': 'Plus de stockage pour vos Coffres',
    'sub.f7': 'Plusieurs Coffres',
    'sub.f8': 'Fonctionnalités professionnelles supplémentaires',

    'free.f1': 'Une carte de visite et son QR Code',
    'free.f2': 'Coordonnées, WhatsApp et e-mail',
    'free.f3': 'Réseaux sociaux et liens illimités',
    'free.f4': 'Mini-site public',
    'free.f5': 'Un Coffre Sécurité (200 Mo)',
    'free.f6': 'Français et anglais',

    'pro.locked': 'Fonctionnalité Pro',
    'pro.lockedText': 'Cette fonctionnalité est disponible avec l’abonnement Pro à 5 000 FCFA/mois.',
    'pro.see': 'Voir Pro',
    'pro.close': 'Plus tard',
  },

  en: {
    'lang.name': 'English',
    'lang.switch': 'Language',

    'plan.free': 'Free',
    'plan.pro': 'Pro',
    'plan.perMonth': '/ month',

    'sub.title': 'My subscription',
    'sub.upgradeTitle': 'Upgrade to Pro',
    'sub.upgradeIntro': 'Unlock the professional features of your digital identity.',
    'sub.cta': 'Upgrade to Pro',
    'sub.current': 'Your current plan',
    'sub.currentFree': 'You are on the Free plan.',
    'sub.currentPro': 'You are subscribed to Pro.',
    'sub.freeTitle': 'What the Free plan already gives you',
    'sub.manage': 'Manage my subscription',
    'sub.cancel': 'Back to the Free plan',
    'sub.paymentPending': 'Payment coming soon',
    'sub.paymentNote':
      'No payment provider is connected yet. The subscription is activated here in demonstration mode, and the amount sent to the future system will be 5,000 FCFA per month.',
    'sub.activate': 'Activate Pro (demonstration)',
    'sub.activated': 'Pro subscription activated.',
    'sub.reverted': 'Back on the Free plan.',

    'sub.f1': 'Premium and VIP cards',
    'sub.f2': 'Multiple cards',
    'sub.f3': 'Advanced personal website',
    'sub.f4': 'Custom domain',
    'sub.f5': 'Advanced statistics',
    'sub.f6': 'More storage for your Secure Vaults',
    'sub.f7': 'Multiple vaults',
    'sub.f8': 'Additional professional features',

    'free.f1': 'One business card and its QR Code',
    'free.f2': 'Contact details, WhatsApp and email',
    'free.f3': 'Unlimited social accounts and links',
    'free.f4': 'Public mini-site',
    'free.f5': 'One Secure Vault (200 MB)',
    'free.f6': 'French and English',

    'pro.locked': 'Pro feature',
    'pro.lockedText': 'This feature is available with the Pro plan at 5,000 FCFA/month.',
    'pro.see': 'See Pro',
    'pro.close': 'Later',
  },
}

export const LANGUAGES = [
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
]

function detectLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'fr' || stored === 'en') return stored
  } catch {
    /* stockage indisponible */
  }
  const preferred = (navigator.languages || [navigator.language || 'fr'])[0] || 'fr'
  return preferred.toLowerCase().startsWith('en') ? 'en' : 'fr'
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(detectLanguage)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((next) => {
    setLanguageState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* stockage indisponible */
    }
  }, [])

  const value = useMemo(() => {
    const table = DICTIONARY[language] || DICTIONARY.fr
    return {
      language,
      setLanguage,
      t: (key) => table[key] ?? DICTIONARY.fr[key] ?? key,
      /** Le prix reste en FCFA quelle que soit la langue : seul le séparateur change. */
      price: (amount = PRO_PRICE) => formatPrice(amount, language),
    }
  }, [language, setLanguage])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useTranslation() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useTranslation doit être utilisé dans LanguageProvider')
  return context
}
