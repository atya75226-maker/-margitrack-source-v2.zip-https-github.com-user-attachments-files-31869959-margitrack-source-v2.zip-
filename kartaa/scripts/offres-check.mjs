/**
 * Kartaa Gratuit / Kartaa Pro : ce que chaque offre montre réellement.
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/offres-check.mjs
 *
 * Trois comptes sont joués sur les mêmes écrans : gratuit, Pro, et Pro échu.
 * Le troisième est le plus important — il vérifie qu'une fin d'abonnement
 * reverrouille sans rien effacer.
 *
 * Ce test regarde l'écran. Le refus réel vient de la base (migration
 * 20260922100000_gratuit_et_pro.sql) : déclencheur sur cards pour les modèles,
 * les entreprises et la galerie, set_card_social_links() pour les quatre
 * réseaux Pro, card_by_slug() pour la mention du mini-site. Cacher un bouton ne
 * protège rien, et ce fichier ne prétend pas le contraire.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const KEY = 'sb-wadapjshbdjkjrfnsnyr-auth-token'
const COMPTE = '11111111-1111-1111-1111-111111111111'
const CARTE = '33333333-3333-3333-3333-333333333333'

const echecs = []
function verifier(nom, condition, detail = '') {
  if (condition) console.log(`  ok   ${nom}`)
  else {
    console.log(`  ÉCHEC ${nom}${detail ? ` ${detail}` : ''}`)
    echecs.push(nom)
  }
}

const session = {
  access_token: 'a.b.c', refresh_token: 'r', token_type: 'bearer',
  expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600,
  user: {
    id: COMPTE, email: 'awa@example.com', aud: 'authenticated',
    user_metadata: { first_name: 'Awa', last_name: 'Diallo' }, app_metadata: {},
    created_at: new Date().toISOString(),
  },
}

const json = (route, corps) => route.fulfill({
  status: 200, contentType: 'application/json',
  headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(corps),
})

/**
 * Une carte qui porte DÉJÀ une entreprise et un compte TikTok.
 *
 * C'est volontaire : elle sert à vérifier qu'un compte gratuit — ou un
 * abonnement échu — voit toujours ces données, et qu'elles ne sont jamais
 * effacées par le verrouillage.
 */
const carte = {
  id: CARTE, user_id: COMPTE, slug: 'awa-diallo', template: 'standard',
  theme: { primary: '#6d28d9', accent: '#f5b229', font: 'sans', layout: 'left' },
  profile: {
    firstName: 'Awa', lastName: 'Diallo', profession: 'Architecte',
    phone: '+225 07 00 12 34 56', whatsapp: '', email: 'awa@example.com',
    address: '', city: 'Abidjan', country: "Côte d'Ivoire",
  },
  about: '', activities: [], services: [], gallery: [], custom_domain: null,
  companies: [{ id: 'cmp1', name: 'Studio Diallo', description: 'Aménagement' }],
  socials: [], scans: 4, created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const LIENS = [
  { id: 'l1', card_id: CARTE, platform: 'instagram', title: 'Mon compte', url: 'https://instagram.com/awa', display_order: 0, is_active: true },
  { id: 'l2', card_id: CARTE, platform: 'tiktok', title: 'Ma chaîne', url: 'https://tiktok.com/@awa', display_order: 1, is_active: true },
]

const browser = await chromium.launch()

async function ouvrir(plan, proUntil = null, fiche = carte) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    locale: 'fr-FR',
    storageState: {
      cookies: [],
      origins: [{
        origin: BASE,
        localStorage: [
          { name: KEY, value: JSON.stringify(session) },
          { name: 'kartaa.language', value: 'fr' },
        ],
      }],
    },
  })
  // Le fourre-tout d'abord : Playwright donne la main à la route enregistrée
  // en dernier, les réponses précises doivent donc venir après.
  await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))
  await context.route('**/rest/v1/profiles*', (route) => json(route, {
    id: COMPTE, first_name: 'Awa', last_name: 'Diallo', email: 'awa@example.com',
    phone: '', avatar_url: '', plan, pro_until: proUntil,
    pro_source: proUntil ? 'chariow' : null,
  }))
  await context.route('**/rest/v1/cards*', (route) => json(route, fiche))
  await context.route('**/rest/v1/social_links*', (route) => json(route, LIENS))
  await context.route('**/rest/v1/card_scans*', (route) => json(route, []))
  return { page: await context.newPage(), context }
}

/**
 * Amène l'assistant à l'étape voulue.
 *
 * Le Stepper n'autorise que le retour en arrière (`index <= current`) : cliquer
 * sur « Réseaux » depuis la première étape ne fait rien. On avance donc comme
 * une vraie personne, avec le bouton « Continuer ».
 */
async function allerALEtape(page, cible) {
  for (let etape = 0; etape < cible; etape += 1) {
    await page.click('button:has-text("Continuer")')
    await page.waitForTimeout(700)
  }
}

/** Texte de la page une fois le rendu posé. */
async function texteDe(page, chemin, attente = 2200) {
  await page.goto(`${BASE}${chemin}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(attente)
  return page.innerText('body')
}

const CAS = [
  { nom: 'Compte gratuit',     plan: 'free', proUntil: null, pro: false },
  { nom: 'Compte Pro',         plan: 'pro',  proUntil: null, pro: true },
  { nom: 'Abonnement Pro échu', plan: 'pro', proUntil: new Date(Date.now() - 86400000).toISOString(), pro: false },
]

for (const cas of CAS) {
  console.log(`\n${cas.nom}`)
  const { page, context } = await ouvrir(cas.plan, cas.proUntil)

  /* ------------------------------------------------- filigrane sur la carte */
  await page.goto(`${BASE}/app/cartes/${CARTE}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  await page.click('button:has-text("Verso")').catch(() => null)
  await page.waitForTimeout(600)

  const filigranes = await page.locator('text=/Powered by Kartaa/i').count()
  if (cas.pro) {
    verifier('aucun filigrane sur la carte Pro', filigranes === 0, `→ ${filigranes}`)
  } else {
    verifier('le filigrane « Powered by Kartaa » est présent', filigranes > 0, `→ ${filigranes}`)
    // Discret, donc petit : une mention qui ferait la taille du nom de marque
    // abîmerait la carte, ce que la consigne interdit explicitement.
    const taille = await page.locator('text=/Powered by Kartaa/i').first()
      .evaluate((n) => parseFloat(getComputedStyle(n).fontSize))
    verifier('le filigrane reste discret (≤ 24 px sur 1050)', taille > 0 && taille <= 24, `→ ${taille}px`)
  }

  // Le rendu hors écran est celui que l'export transforme en PNG/JPG/PDF :
  // s'il n'a pas le filigrane, le fichier téléchargé y échapperait.
  const dansLExport = await page.evaluate(() => {
    const zone = document.querySelector('[aria-hidden].fixed')
    return zone ? /Powered by Kartaa/i.test(zone.textContent) : null
  })
  verifier(cas.pro ? "le rendu d'export n'a pas de filigrane" : "le rendu d'export porte le filigrane",
    dansLExport === !cas.pro, `→ ${dansLExport}`)

  /* -------------------------------------------- carte physique : pas de faux */
  const detail = await page.innerText('body')
  verifier('la carte physique est annoncée sans commande',
    /Carte physique Kartaa/.test(detail) && /Bientôt disponible/.test(detail)
      && !/Préparer ma commande/.test(detail))

  /* ------------------------------------------------ réseaux dans l'assistant */
  await texteDe(page, `/app/cartes/${CARTE}/modifier`, 3000)
  await allerALEtape(page, 1) // 0 Informations → 1 Réseaux
  const reseaux = await page.innerText('body')

  for (const marque of ['Facebook', 'TikTok', 'YouTube', 'Telegram']) {
    const verrou = new RegExp(`${marque} — disponible avec Kartaa Pro`)
    verifier(`${marque} ${cas.pro ? 'ouvert' : 'verrouillé'}`,
      verrou.test(reseaux) === !cas.pro)
  }
  for (const libre of ['WhatsApp', 'Instagram', 'LinkedIn', 'Snapchat']) {
    verifier(`${libre} reste gratuit`,
      !new RegExp(`${libre} — disponible avec Kartaa Pro`).test(reseaux))
  }

  // Les données existantes ne disparaissent jamais avec le verrou. Les adresses
  // sont dans des <input> : innerText ne les voit pas, on lit les valeurs.
  const adresses = await page.locator('input').evaluateAll((n) => n.map((e) => e.value))
  verifier('le compte TikTok déjà enregistré reste visible',
    adresses.some((valeur) => /tiktok\.com\/@awa/.test(valeur || '')), `→ ${cas.nom}`)

  /* ------------------------------------------------------------- entreprise */
  await allerALEtape(page, 2) // 1 Réseaux → 2 Présentation → 3 Entreprises
  const entreprise = await page.innerText('body')

  verifier("l'entreprise déjà enregistrée reste visible",
    /Studio Diallo/.test(entreprise))
  const peutAjouter = await page.locator('button:has-text("Ajouter")').count()
  if (cas.pro) {
    verifier('un abonné peut ajouter une entreprise', peutAjouter > 0)
  } else {
    // Le bouton « Ajouter » des services reste, celui des entreprises part.
    verifier('la conservation des données est annoncée',
      /est conservée et reste affichée/.test(entreprise))
    verifier("l'ajout d'entreprise est annoncé comme inclus dans Pro",
      /informations d’entreprise sont incluses dans Kartaa Pro/i.test(entreprise))
    verifier("le verrou ne se présente pas comme une panne",
      !/erreur|error|indisponible pour le moment/i.test(entreprise))
  }

  await context.close()
}

/* ------------------------------------ couleurs et typographie du mini-site */
console.log('\nPersonnalisation du mini-site')
for (const [plan, pro] of [['free', false], ['pro', true]]) {
  const { page, context } = await ouvrir(plan)
  await texteDe(page, `/app/cartes/${CARTE}/modifier`, 3000)
  await allerALEtape(page, 4) // dernière étape : Design
  const texte = await page.innerText('body')

  verifier(`${plan} : couleurs ${pro ? 'ouvertes' : 'verrouillées'}`,
    /Disponible avec Kartaa Pro —/.test(texte) === !pro)

  // Les réglages restent visibles : on doit voir ce que l'abonnement débloque.
  verifier(`${plan} : les palettes restent affichées`, /Violet/.test(texte) && /Émeraude/.test(texte))
  verifier(`${plan} : la typographie reste affichée`, /Moderne/.test(texte) && /Élégant/.test(texte))

  // Et ils ne répondent plus quand ils sont verrouillés.
  const cliquable = await page.locator('button:has-text("Émeraude")').first()
    .evaluate((n) => {
      const bloque = n.closest('.pointer-events-none')
      return !bloque
    })
  verifier(`${plan} : les palettes ${pro ? 'répondent' : 'ne répondent pas'}`, cliquable === pro)
  await context.close()
}

/* ------------------------- une carte neuve : le verrou complet doit s'afficher */
console.log('\nCarte sans entreprise, compte gratuit')
{
  const vierge = { ...carte, companies: [] }
  const { page, context } = await ouvrir('free', null, vierge)
  await texteDe(page, `/app/cartes/${CARTE}/modifier`, 3000)
  await allerALEtape(page, 3)
  const texte = await page.innerText('body')
  verifier('le panneau « Disponible avec Kartaa Pro » s’affiche',
    /Disponible avec Kartaa Pro/.test(texte))
  verifier('le prix est annoncé', /5\s?000\s?FCFA/.test(texte))
  verifier('le chemin vers l’abonnement est proposé',
    /Passer à Kartaa Pro/.test(texte))
  verifier('ce qui reste gratuit est dit',
    /vos coordonnées et vos services\s+restent gratuits|restent gratuits/.test(texte))
  verifier('aucun message d’erreur technique',
    !/erreur|undefined|NaN/i.test(texte))
  await context.close()
}

/* ------------------------------------ la mention du mini-site suit la base */
console.log('\nMini-site public')
for (const [ownerPlan, attendu] of [['free', true], ['pro', false]]) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'fr-FR' })
  await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))
  await context.route('**/rest/v1/**', (route) => json(route, []))
  await context.route('**/rest/v1/rpc/card_by_slug*', (route) => json(route, {
    id: CARTE, slug: 'awa-diallo', template: 'standard', theme: carte.theme,
    profile: carte.profile, socials: [], about: '', activities: [],
    companies: carte.companies, services: [], gallery: [], scans: 4,
    createdAt: carte.created_at, ownerPlan, ownerAvatarUrl: '',
    socialLinks: [{ id: 'l1', platform: 'instagram', title: 'Mon compte', url: 'https://instagram.com/awa', displayOrder: 0 }],
  }))
  const page = await context.newPage()
  await page.goto(`${BASE}/awa-diallo`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const texte = await page.innerText('body')
  verifier(`propriétaire ${ownerPlan} : mention Kartaa ${attendu ? 'présente' : 'absente'}`,
    /Créez votre profil professionnel/i.test(texte) === attendu)
  verifier(`propriétaire ${ownerPlan} : le profil s'affiche quand même`,
    /Awa/.test(texte) && /Architecte/.test(texte))
  await context.close()
}

/* ------------- l'offre gratuite reste utilisable : on peut créer sa carte */
// C'est le point le plus important de toute cette séparation. Verrouiller des
// options est une chose ; empêcher quelqu'un de créer son identité en serait
// une autre, et ce n'est pas ce qui est voulu.
console.log('\nCréation d’une carte, compte gratuit')
{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    locale: 'fr-FR',
    storageState: {
      cookies: [],
      origins: [{
        origin: BASE,
        localStorage: [
          { name: KEY, value: JSON.stringify(session) },
          { name: 'kartaa.language', value: 'fr' },
        ],
      }],
    },
  })
  await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))
  await context.route('**/rest/v1/profiles*', (route) => json(route, {
    id: COMPTE, first_name: 'Awa', last_name: 'Diallo', email: 'awa@example.com',
    phone: '', avatar_url: '', plan: 'free', pro_until: null, pro_source: null,
  }))
  await context.route('**/rest/v1/cards*', (route) => json(route, [])) // aucune carte encore
  await context.route('**/rest/v1/social_links*', (route) => json(route, []))
  const page = await context.newPage()

  await page.goto(`${BASE}/app/cartes/nouvelle`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  const depart = await page.innerText('body')
  verifier("l'assistant s'ouvre sans mur payant", /Prénom/.test(depart) && !/Passer à Kartaa Pro/.test(depart))

  // Les informations de base : tout ce qu'une offre gratuite doit permettre.
  await page.fill('input[placeholder="Awa"]', 'Awa')
  await page.fill('input[placeholder="Traoré"]', 'Diallo')
  await page.fill('input[placeholder="+225 07 00 00 00 00"]', '+225 07 00 12 34 56')
  await page.waitForTimeout(400)
  await page.click('button:has-text("Continuer")')
  await page.waitForTimeout(900)
  const apres = await page.innerText('body')
  verifier('le nom et le téléphone passent sans abonnement', /Étape 2 sur 5/.test(apres), `→ ${apres.slice(0, 60)}`)

  // WhatsApp et e-mail restent accessibles à l'étape des réseaux.
  verifier('WhatsApp reste utilisable en gratuit',
    /WhatsApp/.test(apres) && !/WhatsApp — disponible avec Kartaa Pro/.test(apres))

  await context.close()
}

/* ----------------------------------- l'offre annoncée ne promet que du réel */
console.log('\nCe qui est vendu existe')
{
  const { page, context } = await ouvrir('free')
  const abonnement = await texteDe(page, '/app/abonnement')
  verifier('aucun QR Code personnalisé promis', !/QR Code personnalisé/i.test(abonnement))
  verifier('aucun domaine personnalisé promis', !/domaine personnalisé/i.test(abonnement))
  verifier('le sans-filigrane est annoncé', /sans la mention Kartaa/i.test(abonnement))
  verifier('les réseaux Pro sont annoncés', /Facebook, TikTok, YouTube et Telegram/i.test(abonnement))
  verifier("les informations d'entreprise sont annoncées", /Informations d’entreprise|Informations d'entreprise/i.test(abonnement))
  verifier('un seul prix, 5 000 FCFA', /5\s?000\s?FCFA/.test(abonnement))

  const accueil = await texteDe(page, '/?accueil=1')
  verifier("l'accueil ne promet plus de réseaux sans limite",
    !/Réseaux et liens sans limite/.test(accueil))
  await context.close()
}

await browser.close()
console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nTout est conforme.')
process.exit(echecs.length ? 1 : 0)
