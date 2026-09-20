/**
 * La carte ne porte que la marque et le QR Code (Playwright).
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/carte-check.mjs
 *
 * Pour chacun des trois modèles, et pour un compte volontairement rempli — nom,
 * photo, métier, entreprise, téléphone, e-mail, réseaux — on vérifie que :
 *
 *   • le recto n'affiche que « Kartaa », au mot près ;
 *   • le verso n'affiche aucun texte, seulement le code ;
 *   • aucune de ces informations ne s'est glissée sur l'une des deux faces ;
 *   • le QR Code téléchargé s'ouvre réellement sur le bon profil public.
 *
 * Lire le texte affiché ne suffirait pas : une photo n'est pas du texte. On
 * compte donc aussi ses pixels dans les fichiers produits, avec une couleur
 * qu'on ne trouve nulle part ailleurs sur la carte.
 */
import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const KEY = 'sb-wadapjshbdjkjrfnsnyr-auth-token'
const CARTE = '33333333-3333-3333-3333-333333333333'
const COMPTE = '11111111-1111-1111-1111-111111111111'
const ADRESSE_PUBLIQUE = 'https://kartaa-eight.vercel.app/awa-diallo'

const PHOTO_URL = 'https://photos.exemple.test/moi.png'
const PHOTO_PNG = (() => {
  const png = new PNG({ width: 240, height: 240 })
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 255
    png.data[i + 1] = 0
    png.data[i + 2] = 255
    png.data[i + 3] = 255
  }
  return PNG.sync.write(png)
})()

/** Pixels de la couleur de la photo de test : zéro est la seule valeur acceptable. */
function comptePhoto(png) {
  let total = 0
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i] > 230 && png.data[i + 1] < 40 && png.data[i + 2] > 230) total += 1
  }
  return total
}

const echecs = []
function verifier(nom, condition, detail = '') {
  if (condition) console.log(`  ok   ${nom}`)
  else {
    console.log(`  ÉCHEC ${nom}${detail ? ` ${detail}` : ''}`)
    echecs.push(nom)
  }
}

/**
 * Un profil volontairement complet : si une seule de ces informations peut
 * remonter sur la carte, ce test doit le voir.
 */
const INFORMATIONS = [
  'Awa', 'Diallo', 'Architecte', 'Studio Diallo', '07 00 12 34 56',
  'awa@example.com', 'Abidjan', 'instagram', 'Scannez', 'kartaa-eight',
]

const carte = (template) => ({
  id: CARTE,
  user_id: COMPTE,
  slug: 'awa-diallo',
  template,
  theme: { primary: '#6d28d9', accent: '#f5b229', font: 'sans', layout: 'left' },
  profile: {
    firstName: 'Awa', lastName: 'Diallo', profession: 'Architecte d’intérieur',
    phone: '+225 07 00 12 34 56', whatsapp: '+225 07 00 12 34 56',
    email: 'awa@example.com', city: 'Abidjan', country: 'Côte d’Ivoire',
    photoUrl: PHOTO_URL, logoUrl: PHOTO_URL,
  },
  about: 'Aménagement de bureaux et de commerces depuis douze ans.',
  activities: ['Décoration'],
  companies: [{ id: 'c1', name: 'Studio Diallo', logoUrl: PHOTO_URL }],
  services: [{ id: 's1', name: 'Plan d’aménagement', price: '150 000 FCFA' }],
  gallery: [],
  socials: {},
  scans: 12,
  custom_domain: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

const session = {
  access_token: 'a.b.c', refresh_token: 'r',
  expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
  user: {
    id: COMPTE, email: 'awa@example.com',
    user_metadata: { first_name: 'Awa', last_name: 'Diallo' },
    app_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
  },
}

const json = (route, corps) => route.fulfill({
  status: 200, contentType: 'application/json',
  headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(corps),
})

let modele = 'standard'

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1280, height: 1000 },
  storageState: { cookies: [], origins: [{ origin: BASE, localStorage: [{ name: KEY, value: JSON.stringify(session) }] }] },
})

await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))
// Compte Pro : les trois modèles sont accessibles, y compris VIP.
await context.route('**/rest/v1/profiles*', (route) => json(route, {
  id: COMPTE, first_name: 'Awa', last_name: 'Diallo', email: 'awa@example.com',
  phone: '', avatar_url: PHOTO_URL, plan: 'pro',
}))
await context.route(PHOTO_URL, (route) => route.fulfill({
  status: 200, contentType: 'image/png',
  headers: { 'Access-Control-Allow-Origin': '*' }, body: PHOTO_PNG,
}))
await context.route('**/rest/v1/cards*', (route) => json(route, carte(modele)))
await context.route('**/rest/v1/social_links*', (route) => json(route, [
  { id: 'l1', card_id: CARTE, platform: 'instagram', title: 'Mon compte', url: 'https://instagram.com/awa', display_order: 0, is_active: true },
]))
await context.route('**/rest/v1/card_scans*', (route) => json(route, []))

const page = await context.newPage()

// On retient le fichier réellement produit plutôt que de le laisser filer sur
// le disque : on peut ainsi l'ouvrir, y lire le QR Code et y compter la photo.
await page.addInitScript(() => {
  window.__telechargements = []
  const clicOriginal = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function intercepte() {
    if (this.download) {
      window.__telechargements.push({ nom: this.download, href: this.href })
      return
    }
    clicOriginal.call(this)
  }
})

function imageDe(dataUrl) {
  return PNG.sync.read(Buffer.from(dataUrl.split(',')[1], 'base64'))
}

async function telechargerVerso() {
  const avant = await page.evaluate(() => (window.__telechargements || []).length)
  await page.click('button:has-text("PNG")')
  await page.waitForFunction((n) => (window.__telechargements || []).length > n, avant, { timeout: 30000 })
  const fichiers = await page.evaluate(() => window.__telechargements)
  return fichiers[fichiers.length - 1]
}

for (const nom of ['standard', 'premium', 'vip']) {
  modele = nom
  console.log(`\nModèle ${nom}`)

  await page.goto(`${BASE}/app/cartes/${CARTE}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Recto', { timeout: 15000 })
  await page.waitForTimeout(2000)

  const carteAffichee = page.locator('.shadow-lift').first()

  // ------------------------------------------------------------------ recto
  const texteRecto = (await carteAffichee.innerText()).trim()
  verifier('le recto n’affiche que « Kartaa »', texteRecto === 'Kartaa', `→ ${JSON.stringify(texteRecto)}`)

  const capturesRecto = PNG.sync.read(await carteAffichee.screenshot())
  verifier('le recto ne montre aucune photo', comptePhoto(capturesRecto) === 0,
    `→ ${comptePhoto(capturesRecto)} pixels`)

  // ------------------------------------------------------------------ verso
  await page.click('button:has-text("Verso")')
  await page.waitForTimeout(1200)
  const texteVerso = (await carteAffichee.innerText()).trim()
  verifier('le verso n’affiche aucun texte', texteVerso === '', `→ ${JSON.stringify(texteVerso)}`)

  const presentes = INFORMATIONS.filter((mot) => texteRecto.includes(mot) || texteVerso.includes(mot))
  verifier('aucune information du profil n’apparaît sur la carte', presentes.length === 0,
    `→ ${presentes.join(', ')}`)

  // Une seule image sur chaque face : le QR Code au verso, rien au recto.
  const images = await carteAffichee.locator('img').count()
  verifier('le verso ne porte que le QR Code', images === 1, `→ ${images} image(s)`)

  // ------------------------------------------------- le fichier téléchargé
  const fichier = await telechargerVerso()
  const image = imageDe(fichier.href)
  const lu = jsQR(new Uint8ClampedArray(image.data), image.width, image.height)
  verifier('le QR Code téléchargé est lisible', !!lu)
  verifier('il ouvre le profil public du propriétaire', lu?.data === ADRESSE_PUBLIQUE, `→ ${lu?.data}`)
  verifier('le verso téléchargé ne contient aucune photo', comptePhoto(image) === 0,
    `→ ${comptePhoto(image)} pixels`)
  // 3150 px de large pour 85 mm, soit environ 940 points par pouce : largement
  // au-delà de ce qu'un imprimeur demande.
  verifier('le fichier est à la résolution d’impression', image.width >= 3000,
    `→ ${image.width}×${image.height}`)
}

await browser.close()
console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nTout est conforme.')
process.exit(echecs.length ? 1 : 0)
