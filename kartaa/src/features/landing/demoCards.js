/**
 * Exemples de la page d'accueil. Aucune donnée réelle, aucun compte réel.
 *
 * Ils ont exactement la forme d'une carte renvoyée par la base — y compris
 * `socialLinks` — parce que la vitrine affiche le vrai composant de profil, pas
 * une maquette. Un exemple mal formé se verrait donc immédiatement.
 *
 * Ces objets ne sont lus que par la page d'accueil. Ils n'entrent jamais dans
 * la base, ne sont jamais enregistrés, et le profil d'une personne connectée
 * affiche toujours ses propres données.
 */

const lien = (platform, url, title = '') => ({ id: `${platform}-${url}`, platform, url, title, isActive: true })

export const DEMO_CARDS = [
  {
    id: 'demo-standard',
    slug: 'awa-traore',
    template: 'standard',
    theme: { primary: '#0f766e', accent: '#facc15', font: 'sans' },
    profile: {
      firstName: 'Awa',
      lastName: 'Traoré',
      profession: 'Consultante en marketing digital',
      phone: '+225 07 00 12 34 56',
      whatsapp: '+225 07 00 12 34 56',
      email: 'awa@studio-akwaba.ci',
      city: 'Abidjan',
      country: "Côte d'Ivoire",
    },
    companies: [{ id: 'c1', name: 'Studio Akwaba' }],
    socialLinks: [
      lien('instagram', 'instagram.com/studioakwaba'),
      lien('linkedin', 'linkedin.com/in/awatraore'),
      lien('tiktok', 'tiktok.com/@studioakwaba'),
      lien('website', 'studio-akwaba.ci', 'Mon site'),
    ],
    about: "Consultante indépendante, j'accompagne les petites entreprises dans leur passage au digital.",
    activities: ['Marketing digital', 'Community management', 'Formation'],
    services: [
      { id: 's1', name: 'Audit de présence en ligne', price: '75 000 FCFA' },
      { id: 's2', name: 'Accompagnement mensuel', description: 'Publication, réponses aux messages, suivi des résultats.', price: '150 000 FCFA / mois' },
    ],
    gallery: [],
  },
  {
    id: 'demo-premium',
    slug: 'ibrahim-sow',
    template: 'premium',
    theme: { primary: '#5b21b6', accent: '#f5b229', font: 'display' },
    profile: {
      firstName: 'Ibrahim',
      lastName: 'Sow',
      profession: "Architecte d'intérieur",
      phone: '+221 77 123 45 67',
      whatsapp: '+221 77 123 45 67',
      email: 'contact@atelier-sow.sn',
      city: 'Dakar',
      country: 'Sénégal',
    },
    companies: [{ id: 'c1', name: 'Atelier Sow' }],
    socialLinks: [
      lien('instagram', 'instagram.com/ateliersow'),
      lien('linkedin', 'linkedin.com/in/ibrahimsow'),
      lien('youtube', 'youtube.com/@ateliersow'),
      lien('website', 'atelier-sow.sn', 'Mes réalisations'),
    ],
    about: "Je conçois des bureaux et des commerces qui ressemblent à ceux qui les occupent.",
    activities: ['Architecture intérieure', 'Décoration', 'Suivi de chantier'],
    services: [{ id: 's1', name: "Plan d'aménagement", price: '250 000 FCFA' }],
    gallery: [],
  },
  {
    id: 'demo-vip',
    slug: 'chantal-mbeki',
    template: 'vip',
    theme: { primary: '#141728', accent: '#f5b229', font: 'serif' },
    profile: {
      firstName: 'Chantal',
      lastName: 'Mbeki',
      profession: "Avocate d'affaires",
      phone: '+237 6 99 88 77 66',
      whatsapp: '+237 6 99 88 77 66',
      email: 'c.mbeki@cabinet-mbeki.cm',
      city: 'Douala',
      country: 'Cameroun',
    },
    companies: [{ id: 'c1', name: 'Cabinet Mbeki & Associés' }],
    socialLinks: [
      lien('linkedin', 'linkedin.com/in/chantalmbeki'),
      lien('website', 'cabinet-mbeki.cm', 'Le cabinet'),
    ],
    about: 'Cabinet spécialisé en droit des affaires et accompagnement des entreprises.',
    activities: ['Droit des affaires', 'Contrats', 'Contentieux'],
    services: [],
    gallery: [],
  },
]
