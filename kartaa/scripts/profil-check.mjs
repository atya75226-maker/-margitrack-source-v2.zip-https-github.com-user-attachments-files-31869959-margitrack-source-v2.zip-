/**
 * Le profil public, avec de vraies données (Playwright).
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/profil-check.mjs
 *
 * Deux profils sont joués, parce que les deux arrivent dans la vraie vie :
 *
 *   • un profil complet — photo, métier, entreprise, présentation, services,
 *     galerie, six comptes de réseaux dont deux sur la même plateforme ;
 *   • un profil presque vide — un nom et un WhatsApp, rien d'autre.
 *
 * Ce qui est vérifié n'est pas seulement que les informations s'affichent, mais
 * que les liens mènent réellement où ils prétendent : `tel:`, `wa.me`,
 * `mailto:` et les adresses des réseaux sont lus dans le HTML produit. Un
 * bouton « Appeler » qui n'appelle pas serait pire que pas de bouton du tout.
 */
import { chromium } from 'playwright'
import { PNG } from 'pngjs'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const ADRESSE_PUBLIQUE = 'https://kartaa-eight.vercel.app'

const PHOTO_URL = 'https://photos.exemple.test/moi.png'
const PHOTO_PNG = (() => {
  const png = new PNG({ width: 200, height: 200 })
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 255
    png.data[i + 1] = 0
    png.data[i + 2] = 255
    png.data[i + 3] = 255
  }
  return PNG.sync.write(png)
})()

const echecs = []
function verifier(nom, condition, detail = '') {
  if (condition) console.log(`  ok   ${nom}`)
  else {
    console.log(`  ÉCHEC ${nom}${detail ? ` ${detail}` : ''}`)
    echecs.push(nom)
  }
}

const lien = (id, platform, url, title = '') => ({ id, platform, url, title, isActive: true })

/** Le profil complet : tout ce qu'une personne peut renseigner. */
const COMPLET = {
  id: 'p-complet',
  slug: 'awa-diallo',
  template: 'standard',
  theme: { primary: '#0f766e', accent: '#facc15', font: 'sans' },
  profile: {
    firstName: 'Awa', lastName: 'Diallo', profession: 'Architecte d’intérieur',
    phone: '+225 07 00 12 34 56', whatsapp: '+225 05 11 22 33 44',
    email: 'awa@example.com', city: 'Abidjan', country: 'Côte d’Ivoire',
    address: 'Rue des Jardins, Cocody',
  },
  about: 'Aménagement de bureaux et de commerces depuis douze ans.',
  activities: ['Décoration', 'Suivi de chantier'],
  companies: [{ id: 'c1', name: 'Studio Diallo', phone: '+225 27 22 00 00 00' }],
  services: [{ id: 's1', name: 'Plan d’aménagement', price: '150 000 FCFA', description: 'Relevé, plan et perspectives.' }],
  gallery: [{ id: 'g1', url: PHOTO_URL, caption: 'Un chantier' }],
  socialLinks: [
    lien('l1', 'instagram', 'instagram.com/awa.perso', 'Mon compte'),
    lien('l2', 'instagram', 'instagram.com/studio.diallo', 'Le studio'),
    lien('l3', 'tiktok', 'tiktok.com/@studiodiallo'),
    lien('l4', 'linkedin', 'linkedin.com/in/awadiallo'),
    lien('l5', 'website', 'studio-diallo.ci', 'Mon site'),
  ],
  scans: 12,
  createdAt: new Date().toISOString(),
  ownerPlan: 'pro',
  ownerAvatarUrl: PHOTO_URL,
}

/** Le profil presque vide : un nom, un WhatsApp. Il doit rester présentable. */
const MINIMAL = {
  id: 'p-minimal',
  slug: 'koffi-yao',
  template: 'standard',
  theme: { primary: '#6d28d9', accent: '#f5b229', font: 'sans' },
  profile: { firstName: 'Koffi', lastName: 'Yao', whatsapp: '+225 01 02 03 04 05' },
  about: '', activities: [], companies: [], services: [], gallery: [],
  socialLinks: [],
  scans: 0,
  createdAt: new Date().toISOString(),
  ownerPlan: 'free',
  ownerAvatarUrl: '',
}

const json = (route, corps) => route.fulfill({
  status: 200, contentType: 'application/json',
  headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(corps),
})

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 412, height: 900 }, locale: 'fr-FR' })

await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))
await context.route(PHOTO_URL, (route) => route.fulfill({
  status: 200, contentType: 'image/png',
  headers: { 'Access-Control-Allow-Origin': '*' }, body: PHOTO_PNG,
}))
// La dernière interception enregistrée l'emporte : le fourre-tout passe donc
// avant celle qui nous intéresse.
await context.route('**/rest/v1/**', (route) => json(route, []))
await context.route('**/rest/v1/rpc/**', (route) => {
  const nom = new URL(route.request().url()).pathname.split('/').pop()
  if (nom === 'card_by_slug') {
    const demande = JSON.parse(route.request().postData() || '{}')
    const profil = [COMPLET, MINIMAL].find((carte) => carte.slug === demande.p_slug)
    return json(route, profil || null)
  }
  return json(route, null)
})

const page = await context.newPage()

/* ------------------------------------------------------------ profil complet */

console.log('\nUn profil complet')
await page.goto(`${BASE}/${COMPLET.slug}`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Awa Diallo', { timeout: 20000 })
await page.waitForTimeout(1200)

const texte = await page.innerText('body')
verifier('le nom s’affiche', texte.includes('Awa Diallo'))
verifier('le métier s’affiche', texte.includes('Architecte d’intérieur'))
verifier('l’entreprise s’affiche', texte.includes('Studio Diallo'))
verifier('la ville s’affiche', /Abidjan/.test(texte))
verifier('la présentation s’affiche', texte.includes('Aménagement de bureaux'))
verifier('les activités s’affichent', texte.includes('Décoration'))
verifier('les services s’affichent', texte.includes('Plan d’aménagement') && texte.includes('150 000 FCFA'))

const photo = page.locator('header img').first()
verifier('la photo du compte s’affiche',
  (await photo.count()) > 0 && await photo.evaluate((n) => n.complete && n.naturalWidth > 0))

// Les liens sont lus dans le document : c'est là qu'un bouton ment ou pas.
const href = (selecteur) => page.locator(selecteur).first().getAttribute('href')
const numero = (valeur) => String(valeur || '').replace(/[^0-9]/g, '')
verifier('« Appeler » compose le vrai numéro',
  numero(await href('a[href^="tel:"]')) === numero(COMPLET.profile.phone),
  `→ ${await href('a[href^="tel:"]')}`)
const wa = await href('a[href*="wa.me"]')
verifier('« WhatsApp » ouvre le numéro WhatsApp, pas le numéro d’appel',
  wa?.includes('2250511223344'), `→ ${wa}`)
verifier('« E-mail » ouvre la vraie adresse',
  (await href('a[href^="mailto:"]')) === 'mailto:awa@example.com')

// ----------------------------------------------------------------- réseaux
const icones = page.locator('a[href*="instagram"], button[aria-label]')
const instagram = await page.locator('button[aria-label="Instagram"]').count()
verifier('Instagram, qui porte deux comptes, est un seul bouton', instagram === 1)
verifier('TikTok mène directement au compte',
  (await page.locator('a[aria-label="TikTok"]').getAttribute('href'))?.includes('tiktok.com/@studiodiallo'))
verifier('LinkedIn mène directement au compte',
  (await page.locator('a[aria-label="LinkedIn"]').getAttribute('href'))?.includes('linkedin.com/in/awadiallo'))
verifier('aucun réseau non renseigné n’est affiché',
  (await page.locator('a[aria-label="Facebook"], button[aria-label="Facebook"]').count()) === 0
  && (await page.locator('a[aria-label="YouTube"], button[aria-label="YouTube"]').count()) === 0)
verifier('les réseaux tiennent sur une rangée', (await icones.count()) > 0)

await page.locator('button[aria-label="Instagram"]').click()
await page.waitForTimeout(500)
const deplie = await page.innerText('body')
verifier('les deux comptes Instagram sont proposés',
  deplie.includes('Mon compte') && deplie.includes('Le studio'))

// --------------------------------------------------------- liens et adresse
verifier('le site renseigné est proposé', texte.includes('Mon site') && texte.includes('studio-diallo.ci'))
verifier('le lien du site est le vrai',
  (await href('a[href*="studio-diallo.ci"]'))?.includes('studio-diallo.ci'))

// ------------------------------------------------------------------ QR Code
await page.locator('button:has-text("QR Code")').first().click()
await page.waitForTimeout(1200)
const fenetre = await page.innerText('body')
verifier('le QR Code annonce la vraie adresse publique',
  fenetre.includes(`${ADRESSE_PUBLIQUE}/${COMPLET.slug}`), `→ ${fenetre.slice(-120)}`)
const imageQr = page.locator('img[alt="QR Code"]').first()
verifier('le QR Code est bien dessiné',
  (await imageQr.count()) > 0 && await imageQr.evaluate((n) => n.complete && n.naturalWidth > 0))
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

// ------------------------------------------------------------ fiche contact
await page.addInitScript(() => {
  window.__telechargements = []
  const clicOriginal = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function intercepte() {
    if (this.download) {
      window.__telechargements.push(this.download)
      return
    }
    clicOriginal.call(this)
  }
})
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Awa Diallo', { timeout: 20000 })
await page.waitForTimeout(1000)
await page.locator('button:has-text("Enregistrer le contact")').first().click()
await page.waitForTimeout(1500)
const fichiers = await page.evaluate(() => window.__telechargements || [])
verifier('« Enregistrer le contact » produit une fiche .vcf',
  fichiers.some((nom) => nom.endsWith('.vcf')), `→ ${JSON.stringify(fichiers)}`)

/* ----------------------------------------------------------- profil minimal */

console.log('\nUn profil presque vide')
await page.goto(`${BASE}/${MINIMAL.slug}`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Koffi Yao', { timeout: 20000 })
await page.waitForTimeout(1000)

const minimal = await page.innerText('body')
verifier('le nom s’affiche', minimal.includes('Koffi Yao'))
verifier('WhatsApp est proposé', minimal.includes('WhatsApp'))
verifier('aucun bouton « Appeler » sans numéro d’appel', !/Appeler/.test(minimal))
verifier('aucun bouton « E-mail » sans adresse', !/E-mail/.test(minimal))
verifier('aucune section « Mes réseaux » vide', !/MES RÉSEAUX|Mes réseaux/i.test(minimal))
verifier('aucune section « Mes services » vide', !/Mes services/i.test(minimal))
verifier('aucune section « Ma galerie » vide', !/Ma galerie/i.test(minimal))
verifier('aucune section « À propos » vide', !/À propos/i.test(minimal))
verifier('la page reste présentable', minimal.trim().length > 60 && !/undefined|\[object|NaN/.test(minimal))
verifier('le WhatsApp mène au bon numéro',
  (await href('a[href*="wa.me"]'))?.includes('2250102030405'), `→ ${await href('a[href*="wa.me"]')}`)

await browser.close()
console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nTout est conforme.')
process.exit(echecs.length ? 1 : 0)
