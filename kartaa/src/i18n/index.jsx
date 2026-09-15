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
    'sub.paymentPending': 'Demander l’abonnement Pro',
    'sub.paymentNote':
      'Aucun prestataire de paiement n’est encore connecté : cette demande n’active donc rien et ne vous prélève rien. Elle nous signale que vous voulez passer à Pro, et nous vous contacterons pour l’activation.',
    'sub.activate': 'Envoyer ma demande',
    'sub.activated': 'Demande enregistrée. Nous vous contactons pour l’activation.',
    'sub.alreadyRequested': 'Votre demande est déjà enregistrée.',
    'sub.reverted': 'Retour à l’offre Gratuit.',
    'sub.manageNote':
      'Pour suspendre ou reprendre votre abonnement, écrivez-nous : le changement d’offre se fait de notre côté, jamais depuis cette page.',

    'sub.f1': 'Plusieurs cartes professionnelles',
    'sub.f2': 'Modèles Premium',
    'sub.f3': 'Modèles VIP',
    'sub.f4': 'Personnalisation avancée',
    'sub.f5': 'Mini-site avancé : galerie, plusieurs entreprises, plusieurs activités',
    'sub.f6': 'Statistiques avancées',
    'sub.f7': 'Domaine personnalisé',
    'sub.f8': 'Plusieurs Coffres Sécurité',
    'sub.f9': 'Stockage supérieur',
    'sub.f10': 'QR Code personnalisé',

    'free.f1': 'Une carte professionnelle',
    'free.f2': 'Modèle Standard',
    'free.f3': 'Mini-site public : coordonnées, WhatsApp, e-mail, réseaux, services',
    'free.f4': 'Réseaux sociaux et liens illimités',
    'free.f5': 'Scanner QR universel',
    'free.f6': 'Historique des scans',
    'free.f7': 'Un Coffre Sécurité (200 Mo)',
    'free.f8': 'Application installable',
    'free.f9': 'Français et anglais',

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
    'sub.paymentPending': 'Request the Pro plan',
    'sub.paymentNote':
      'No payment provider is connected yet, so this request activates nothing and charges you nothing. It tells us you want Pro, and we will contact you to activate it.',
    'sub.activate': 'Send my request',
    'sub.activated': 'Request saved. We will contact you to activate it.',
    'sub.alreadyRequested': 'Your request is already on file.',
    'sub.reverted': 'Back on the Free plan.',
    'sub.manageNote':
      'To pause or resume your subscription, write to us: plan changes happen on our side, never from this page.',

    'sub.f1': 'Multiple business cards',
    'sub.f2': 'Premium templates',
    'sub.f3': 'VIP templates',
    'sub.f4': 'Advanced personalisation',
    'sub.f5': 'Advanced mini-site: gallery, several companies, several activities',
    'sub.f6': 'Advanced statistics',
    'sub.f7': 'Custom domain',
    'sub.f8': 'Multiple Secure Vaults',
    'sub.f9': 'More storage',
    'sub.f10': 'Custom QR Code',

    'free.f1': 'One business card',
    'free.f2': 'Standard template',
    'free.f3': 'Public mini-site: contact details, WhatsApp, email, socials, services',
    'free.f4': 'Unlimited social accounts and links',
    'free.f5': 'Universal QR scanner',
    'free.f6': 'Scan history',
    'free.f7': 'One Secure Vault (200 MB)',
    'free.f8': 'Installable app',
    'free.f9': 'French and English',

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
