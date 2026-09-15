/**
 * Téléchargement du recto et du verso (Playwright).
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/export-check.mjs
 *
 * Le test intercepte le clic de téléchargement pour récupérer le fichier
 * réellement produit — son nom et ses octets — puis vérifie que le verso n'est
 * ni vide, ni une copie du recto, et qu'il contient bien ce que le verso
 * affiche. Regarder l'écran ne suffisait pas : le recto s'affichait
 * correctement, c'est le fichier qui était faux.
 */
import { chromium } from 'playwright'
import { PNG } from 'pngjs'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const KEY = 'sb-wadapjshbdjkjrfnsnyr-auth-token'
const CARTE = '33333333-3333-3333-3333-333333333333'
const COMPTE = '11111111-1111-1111-1111-111111111111'

const echecs = []
function verifier(nom, condition, detail = '') {
  if (condition) console.log(`  ok   ${nom}`)
  else {
    console.log(`  ÉCHEC ${nom}${detail ? ` ${detail}` : ''}`)
    echecs.push(nom)
  }
}

const carte = {
  id: CARTE,
  user_id: COMPTE,
  slug: 'awa-diallo',
  template: 'standard',
  theme: { primary: '#6d28d9', accent: '#f5b229', font: 'sans', layout: 'left' },
  profile: {
    firstName: 'Awa', lastName: 'Diallo', profession: 'Architecte d’intérieur',
    phone: '+225 07 00 12 34 56', whatsapp: '+225 07 00 12 34 56',
    email: 'awa@example.com', city: 'Abidjan', country: 'Côte d’Ivoire',
  },
  about: 'Aménagement de bureaux et de commerces depuis douze ans.',
  activities: ['Décoration'],
  companies: [{ id: 'c1', name: 'Studio Diallo' }],
  services: [{ id: 's1', name: 'Plan d’aménagement', price: '150 000 FCFA' }],
  gallery: [],
  socials: {},
  scans: 12,
  custom_domain: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

function session() {
  return {
    access_token: 'a.b.c', refresh_token: 'r',
    expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
    user: {
      id: COMPTE, email: 'awa@example.com',
      user_metadata: { first_name: 'Awa', last_name: 'Diallo' },
      app_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
    },
  }
}

function json(route, corps) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(corps),
  })
}

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1280, height: 1000 },
  storageState: { cookies: [], origins: [{ origin: BASE, localStorage: [{ name: KEY, value: JSON.stringify(session()) }] }] },
})

await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))
await context.route('**/rest/v1/profiles*', (route) => json(route, {
  id: COMPTE, first_name: 'Awa', last_name: 'Diallo', email: 'awa@example.com',
  phone: '', avatar_url: '', plan: 'pro',
}))
await context.route('**/rest/v1/cards*', (route) => json(route, carte))
await context.route('**/rest/v1/social_links*', (route) => json(route, [
  { id: 'l1', card_id: CARTE, platform: 'instagram', title: 'Mon compte', url: 'https://instagram.com/awa', display_order: 0, is_active: true },
]))
await context.route('**/rest/v1/card_scans*', (route) => json(route, []))
await context.route('**/rest/v1/vaults*', (route) => json(route, []))

const page = await context.newPage()

// On retient le fichier réellement produit au lieu de laisser le navigateur
// l'écrire sur le disque : on peut ainsi l'ouvrir et le comparer.
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

await page.goto(`${BASE}/app/cartes/${CARTE}`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Recto', { timeout: 15000 })
await page.waitForTimeout(2500)

async function telecharger(face) {
  await page.click(`button:has-text("${face}")`)
  await page.waitForTimeout(600)
  await page.click('button:has-text("PNG")')
  await page.waitForFunction(
    (attendu) => (window.__telechargements || []).length >= attendu,
    face === 'Recto' ? 1 : 2,
    { timeout: 30000 },
  )
  const fichiers = await page.evaluate(() => window.__telechargements)
  return fichiers[fichiers.length - 1]
}

function imageDe(dataUrl) {
  const brut = Buffer.from(dataUrl.split(',')[1], 'base64')
  return { png: PNG.sync.read(brut), octets: brut.length }
}

/** Part des pixels qui ne sont pas de la couleur dominante — un fichier vide tombe à zéro. */
function richesse(png) {
  const compte = new Map()
  for (let i = 0; i < png.data.length; i += 4) {
    const cle = `${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`
    compte.set(cle, (compte.get(cle) || 0) + 1)
  }
  const total = png.width * png.height
  const dominante = Math.max(...compte.values())
  return { varies: 1 - dominante / total, couleurs: compte.size }
}

console.log('\nTéléchargement des deux faces')

const recto = await telecharger('Recto')
verifier('le recto porte « recto » dans son nom', /recto/.test(recto.nom), `→ ${recto.nom}`)

const verso = await telecharger('Verso')
verifier('le verso porte « verso » dans son nom', /verso/.test(verso.nom), `→ ${verso.nom}`)

const imageRecto = imageDe(recto.href)
const imageVerso = imageDe(verso.href)

verifier('le recto est une vraie image', imageRecto.png.width > 100 && imageRecto.png.height > 100,
  `→ ${imageRecto.png.width}×${imageRecto.png.height}`)
verifier('le verso est une vraie image', imageVerso.png.width > 100 && imageVerso.png.height > 100,
  `→ ${imageVerso.png.width}×${imageVerso.png.height}`)
verifier('les deux faces ont la même taille',
  imageRecto.png.width === imageVerso.png.width && imageRecto.png.height === imageVerso.png.height)

const richesseVerso = richesse(imageVerso.png)
verifier('le verso n’est pas vide', richesseVerso.varies > 0.05 && richesseVerso.couleurs > 50,
  `→ ${(richesseVerso.varies * 100).toFixed(1)} % de pixels non uniformes, ${richesseVerso.couleurs} couleurs`)

const identiques = imageRecto.png.data.equals(imageVerso.png.data)
verifier('le verso n’est pas une copie du recto', !identiques)

// Le contenu du verso doit correspondre à ce que l'écran affiche.
await page.click('button:has-text("Verso")')
await page.waitForTimeout(800)
const capture = PNG.sync.read(await page.locator('.shadow-lift').first().screenshot())
const versoAffiche = richesse(capture)
verifier('le verso affiché et le verso téléchargé se ressemblent',
  Math.abs(versoAffiche.varies - richesseVerso.varies) < 0.25,
  `→ écran ${(versoAffiche.varies * 100).toFixed(1)} %, fichier ${(richesseVerso.varies * 100).toFixed(1)} %`)

await browser.close()
console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nTout est conforme.')
process.exit(echecs.length ? 1 : 0)
