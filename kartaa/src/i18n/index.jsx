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
    'sub.paymentPending': 'Passer à Pro — 5 000 FCFA / mois',
    'sub.paymentNote':
      'Vous allez être redirigé vers notre page de paiement sécurisée. Votre abonnement s’active automatiquement dès que le paiement est confirmé — vous n’avez rien d’autre à faire.',
    'sub.emailNotice':
      'Important : payez avec l’adresse e-mail de votre compte, c’est elle qui rattache le paiement à votre abonnement. Votre adresse :',
    'sub.activate': 'Aller au paiement',
    'sub.activated': 'Demande enregistrée. Nous vous contactons pour l’activation.',
    'sub.expired': 'Votre abonnement Pro a expiré.',
    'sub.expiredOn': 'Expiré le',
    'sub.until': 'Actif jusqu’au',
    'sub.alreadyRequested': 'Votre demande est déjà enregistrée.',
    'sub.reverted': 'Retour à l’offre Gratuit.',
    'sub.manageNote':
      'Votre abonnement se renouvelle par un nouveau paiement. Pour le suspendre ou poser une question, écrivez-nous : le changement d’offre se fait côté serveur, jamais depuis cette page.',

    'sub.f1': 'Plusieurs cartes professionnelles',
    'sub.f2': 'Modèles Premium et VIP',
    'sub.f3': 'Facebook, Instagram, Telegram et X sur votre profil',
    'sub.f4': 'Informations d’entreprise : structure, logo, adresse, site professionnel',
    'sub.f5': 'Profil avancé : galerie photos, plusieurs activités, couleurs et typographie',
    'sub.f6': 'Statistiques avancées des interactions',
    'sub.f7': 'Carte et profil public sans la mention Kartaa',

    'free.f1': 'Une carte professionnelle',
    'free.f2': 'Modèle Standard',
    'free.f3': 'Mini-site public : coordonnées, WhatsApp, e-mail, services',
    'free.f4': 'TikTok, YouTube, LinkedIn, Snapchat, sites web et liens sans limite',
    'free.f5': 'Scanner QR universel',
    'free.f6': 'Historique des scans',
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
    'sub.paymentPending': 'Upgrade to Pro — 5,000 FCFA / month',
    'sub.paymentNote':
      'You will be taken to our secure payment page. Your subscription activates automatically once the payment is confirmed — nothing else to do.',
    'sub.emailNotice':
      'Important: pay with your account email address — that is what links the payment to your subscription. Your address:',
    'sub.activate': 'Go to payment',
    'sub.activated': 'Request saved. We will contact you to activate it.',
    'sub.expired': 'Your Pro subscription has expired.',
    'sub.expiredOn': 'Expired on',
    'sub.until': 'Active until',
    'sub.alreadyRequested': 'Your request is already on file.',
    'sub.reverted': 'Back on the Free plan.',
    'sub.manageNote':
      'Your subscription renews with a new payment. To pause it or ask a question, write to us: plan changes happen server-side, never from this page.',

    'sub.f1': 'Multiple business cards',
    'sub.f2': 'Premium and VIP templates',
    'sub.f3': 'Facebook, Instagram, Telegram and X on your profile',
    'sub.f4': 'Company details: business name, logo, address, professional website',
    'sub.f5': 'Advanced profile: photo gallery, several activities, colours and type',
    'sub.f6': 'Advanced interaction statistics',
    'sub.f7': 'No Kartaa mention on your card or public profile',

    'free.f1': 'One business card',
    'free.f2': 'Standard template',
    'free.f3': 'Public mini-site: contact details, WhatsApp, email, services',
    'free.f4': 'TikTok, YouTube, LinkedIn, Snapchat, websites and unlimited links',
    'free.f5': 'Universal QR scanner',
    'free.f6': 'Scan history',
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
