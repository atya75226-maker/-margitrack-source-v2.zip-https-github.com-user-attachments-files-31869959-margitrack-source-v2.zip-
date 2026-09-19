/**
 * Kartaa hors connexion (Playwright).
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/offline-check.mjs
 *
 * Reprend les huit scénarios demandés, avec une vraie coupure réseau
 * (context.setOffline) et non une simulation dans le code : l'application est
 * traitée comme elle le serait sur un téléphone sans réseau.
 */
import { createServer } from 'node:http'
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const KEY = 'sb-wadapjshbdjkjrfnsnyr-auth-token'
const COMPTE = '11111111-1111-1111-1111-111111111111'
const CARTE = '33333333-3333-3333-3333-333333333333'

/**
 * Petit serveur d'images, pour de vrai.
 *
 * Les requêtes lancées par un service worker n'passent pas par les
 * interceptions de Playwright : une image simulée ne prouverait donc rien de
 * son cache. Celle-ci est servie par un vrai serveur, sur le réseau local, et
 * traverse le même chemin qu'en production.
 */
const PORT_IMAGES = 4179
const IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAG0lEQVR4nGP8z8DwnwEPYMInOSgU'
  + 'MAADAAD//wMXAP8kOlUTAAAAAElFTkSuQmCC',
  'base64',
)
const CHEMIN_IMAGE = '/storage/v1/object/public/card-assets/awa.png'
const PHOTO = `http://localhost:${PORT_IMAGES}${CHEMIN_IMAGE}`
const serveurImages = createServer((requete, reponse) => {
  if (!requete.url.startsWith(CHEMIN_IMAGE)) {
    reponse.writeHead(404).end()
    return
  }
  reponse.writeHead(200, { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' })
  reponse.end(IMAGE)
})
await new Promise((pret) => serveurImages.listen(PORT_IMAGES, pret))

const echecs = []
function verifier(nom, condition, detail = '') {
  if (condition) console.log(`  ok   ${nom}`)
  else {
    console.log(`  ÉCHEC ${nom}${detail ? ` ${detail}` : ''}`)
    echecs.push(nom)
  }
}

const carte = {
  id: CARTE, user_id: COMPTE, slug: 'awa-diallo', template: 'standard',
  theme: { primary: '#6d28d9', accent: '#f5b229', font: 'sans', layout: 'left' },
  profile: {
    firstName: 'Awa', lastName: 'Diallo', profession: "Architecte d'intérieur",
    phone: '+225 07 00 12 34 56', whatsapp: '+225 07 00 12 34 56', email: 'awa@example.com',
  },
  about: '', activities: [], companies: [{ id: 'c1', name: 'Studio Diallo' }],
  services: [], gallery: [], socials: {}, scans: 12, custom_domain: null,
  created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z',
}

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
  headers: { 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(corps),
})

// Ce que le « serveur » a reçu : sert à prouver la synchronisation.
const recu = []

/**
 * Couper le réseau ne suffit pas : une interception Playwright répond même
 * hors ligne. Ce drapeau fait échouer les interceptions comme le ferait une
 * vraie absence de réseau — sinon le test se mentirait à lui-même.
 */
let horsLigne = false
const siEnLigne = (gestionnaire) => (route, ...reste) =>
  (horsLigne ? route.abort('failed') : gestionnaire(route, ...reste))

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 412, height: 900 }, locale: 'fr-FR',
  storageState: { cookies: [], origins: [{ origin: BASE, localStorage: [{ name: KEY, value: JSON.stringify(session) }] }] },
})

await context.route('**/rest/v1/profiles*', siEnLigne((route) => json(route, {
  id: COMPTE, first_name: 'Awa', last_name: 'Diallo', email: 'awa@example.com',
  phone: '', avatar_url: '', plan: 'free',
})))
await context.route('**/rest/v1/cards*', siEnLigne((route) => {
  const url = route.request().url()
  if (route.request().method() === 'PATCH') {
    recu.push({ type: 'carte', corps: JSON.parse(route.request().postData() || '{}') })
    return json(route, carte)
  }
  if (url.includes('user_id=eq.')) return json(route, [carte])
  if (url.includes('id=eq.')) return json(route, carte)
  return json(route, [])
}))
await context.route('**/rest/v1/social_links*', siEnLigne((route) => json(route, [])))
await context.route('**/rest/v1/card_scans*', siEnLigne((route) => json(route, [])))
await context.route('**/rest/v1/rpc/**', siEnLigne((route) => {
  const nom = new URL(route.request().url()).pathname.split('/').pop()
  if (nom === 'card_by_slug') {
    const demande = JSON.parse(route.request().postData() || '{}')
    if (demande.p_slug !== carte.slug) return json(route, null)
    return json(route, {
      id: CARTE, slug: carte.slug, template: carte.template, theme: carte.theme,
      profile: carte.profile, socials: {}, about: '', activities: [],
      companies: carte.companies, services: [], gallery: [], scans: 12,
      createdAt: carte.created_at, ownerPlan: 'free', ownerAvatarUrl: PHOTO, socialLinks: [],
    })
  }
  if (nom === 'set_card_social_links') {
    recu.push({ type: 'liens' })
    return json(route, null)
  }
  if (nom === 'slug_available') return json(route, true)
  return json(route, null)
}))

const page = await context.newPage()

/** Vrai quand la photo du mini-site est réellement dessinée, et pas seulement présente. */
const photoChargee = async () => {
  const photo = page.locator(`img[src="${PHOTO}"]`).first()
  if (!(await photo.count())) return false
  return photo.evaluate((n) => n.complete && n.naturalWidth > 0).catch(() => false)
}

/* ------------------------------------------------------- avec le réseau */

console.log('\nPremière utilisation, avec le réseau')
await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Votre tableau de bord', { timeout: 20000 })
await page.waitForTimeout(2500)
verifier('la carte est chargée et enregistrée localement',
  (await page.locator('text=Awa Diallo').count()) > 0)

// Test 6, premier temps : on ouvre un profil public avec le réseau.
await page.goto(`${BASE}/${carte.slug}`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Awa Diallo', { timeout: 20000 })
await page.waitForTimeout(1500)
verifier('le profil public est consulté une première fois', true)
verifier('la photo du profil est affichée', await photoChargee())

/* --------------------------------------------------------- sans réseau */

await context.setOffline(true)
horsLigne = true

console.log('\nTEST 1 — rouvrir l’application sans réseau')
await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' })
const demarre = await page
  .waitForSelector('text=Votre tableau de bord', { timeout: 20000 })
  .then(() => true)
  .catch(() => false)
verifier('l’application démarre', demarre, `→ ${page.url()}`)
await page.waitForTimeout(2000)

console.log('\nTEST 2 — la carte reste visible')
const texteAccueil = await page.innerText('body')
verifier('la carte est affichée', /Awa Diallo/.test(texteAccueil))
verifier('l’état « hors connexion » est annoncé', /Hors connexion/i.test(texteAccueil),
  `→ ${texteAccueil.slice(0, 120)}`)

console.log('\nTEST 3 — le QR Code s’affiche sans réseau')
await page.goto(`${BASE}/app/cartes/${CARTE}`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
await page.locator('button:has-text("Verso")').first().click().catch(() => null)
await page.waitForTimeout(1500)
const qr = await page.locator('img[alt="QR Code"]').first()
const visible = (await qr.count()) > 0 && await qr.evaluate((n) => n.naturalWidth > 50).catch(() => false)
verifier('le QR Code est bien dessiné', visible)

console.log('\nTEST 4 — modifier une information sans réseau')
await page.goto(`${BASE}/app/cartes/${CARTE}/modifier`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[placeholder="Awa"]', { timeout: 20000 })
await page.fill('input[placeholder="Consultante en marketing digital"]', 'Agent immobilier')
for (let i = 0; i < 5; i += 1) {
  const suivant = page.locator('button:has-text("Continuer")')
  if (await suivant.count()) {
    await suivant.first().click()
    await page.waitForTimeout(500)
  }
}
const enregistrer = page.locator('button:has-text("Enregistrer")')
verifier('le bouton d’enregistrement est atteint', (await enregistrer.count()) > 0)
if (await enregistrer.count()) await enregistrer.first().click()
await page.waitForTimeout(2500)
const apresEnregistrement = await page.innerText('body')
verifier('la modification est annoncée comme enregistrée sur l’appareil',
  /enregistrée sur cet appareil/i.test(apresEnregistrement), `→ ${apresEnregistrement.slice(0, 160)}`)
verifier('rien n’est parti vers le serveur', recu.length === 0, `→ ${recu.length} envoi(s)`)

console.log('\nTEST 6 — rouvrir un profil public déjà consulté')
await page.goto(`${BASE}/${carte.slug}`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
const profil = await page.innerText('body')
verifier('le profil s’affiche depuis la copie locale', /Awa Diallo/.test(profil), `→ ${profil.slice(0, 120)}`)
verifier('la page annonce le mode hors connexion',
  /hors connexion — dernières données/i.test(profil), `→ ${profil.slice(0, 160)}`)
// La photo vient du cache d'images du service worker : le serveur qui la sert
// est resté allumé, mais le navigateur, lui, est réellement hors réseau.
verifier('la photo déjà vue s’affiche sans réseau', await photoChargee())
// Voir la photo ne suffit pas à prouver qu'elle est conservée : le cache HTTP
// du navigateur peut la servir aussi, et rien ne garantit qu'il la garde. On
// vérifie donc qu'elle est bien rangée là où on a dit qu'elle le serait.
const rangeeParLeServiceWorker = await page.evaluate(async (adresse) => {
  const nom = (await caches.keys()).find((cle) => cle.endsWith('-images'))
  if (!nom) return false
  return !!(await caches.open(nom).then((cache) => cache.match(adresse)))
}, PHOTO)
verifier('elle est réellement conservée par le service worker', rangeeParLeServiceWorker)

console.log('\nTEST 8 — un profil jamais consulté')
await page.goto(`${BASE}/inconnu-jamais-vu`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
const inconnu = await page.innerText('body')
verifier('une explication claire s’affiche', /connexion nécessaire/i.test(inconnu), `→ ${inconnu.slice(0, 160)}`)
verifier('ce n’est ni une page blanche ni une erreur technique',
  inconnu.trim().length > 40 && !/TypeError|undefined|\[object/i.test(inconnu))

console.log('\nTEST 7 — le scanner s’ouvre sans réseau')
await page.goto(`${BASE}/app/scanner`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
const scanner = await page.innerText('body')
verifier('l’écran du scanner est disponible', /scanner/i.test(scanner) && !/impossible de se connecter/i.test(scanner))

/* ------------------------------------------------------ retour du réseau */

console.log('\nTEST 5 — le réseau revient')
await context.setOffline(false)
horsLigne = false
await page.evaluate(() => window.dispatchEvent(new Event('online')))
await page.waitForTimeout(4000)
verifier('la modification est envoyée au serveur', recu.some((envoi) => envoi.type === 'carte'),
  `→ ${JSON.stringify(recu.map((e) => e.type))}`)
verifier('elle n’est envoyée qu’une seule fois',
  recu.filter((envoi) => envoi.type === 'carte').length === 1,
  `→ ${recu.filter((e) => e.type === 'carte').length} envoi(s)`)

await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)
const apresSynchro = await page.innerText('body')
verifier('l’application n’annonce plus de modification en attente',
  !/À synchroniser/i.test(apresSynchro), `→ ${apresSynchro.slice(0, 120)}`)

await browser.close()
serveurImages.close()
console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nTout est conforme.')
process.exit(echecs.length ? 1 : 0)
