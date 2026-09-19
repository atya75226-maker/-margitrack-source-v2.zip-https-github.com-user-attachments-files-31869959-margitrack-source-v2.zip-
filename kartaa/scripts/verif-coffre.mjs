/**
 * Le Coffre Sécurité ne doit plus apparaître nulle part (Playwright).
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/verif-coffre.mjs
 *
 * Parcourt chaque écran de l'application, ouvre le bouton « + » de la barre du
 * bas, et vérifie qu'aucun mot « coffre » ne s'affiche. Vérifie aussi que les
 * anciennes adresses ne mènent plus à un écran de coffre.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const KEY = 'sb-wadapjshbdjkjrfnsnyr-auth-token'
const COMPTE = '11111111-1111-1111-1111-111111111111'

const echecs = []
function verifier(nom, condition, detail = '') {
  if (condition) console.log(`  ok   ${nom}`)
  else {
    console.log(`  ÉCHEC ${nom}${detail ? ` ${detail}` : ''}`)
    echecs.push(nom)
  }
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
const json = (r, b) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(b) })

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 412, height: 900 }, locale: 'fr-FR',
  storageState: { cookies: [], origins: [{ origin: BASE, localStorage: [{ name: KEY, value: JSON.stringify(session) }] }] },
})
await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))
await context.route('**/rest/v1/profiles*', (route) => json(route, {
  id: COMPTE, first_name: 'Awa', last_name: 'Diallo', email: 'awa@example.com',
  phone: '', avatar_url: '', plan: 'pro',
}))
await context.route('**/rest/v1/cards*', (route) => json(route, []))
const page = await context.newPage()

console.log('\nAucun écran ne parle du coffre')
for (const route of ['/', '/app', '/app/cartes', '/app/scanner', '/app/statistiques', '/app/profil', '/app/abonnement', '/connexion', '/inscription']) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const texte = await page.innerText('body')
  const trouve = texte.match(/.{0,35}coffre.{0,35}/i)
  verifier(route, !trouve, trouve ? `→ « ${trouve[0].trim()} »` : '')
}

console.log('\nLe bouton « + » mène directement à la création de carte')
await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('button[aria-label="Créer"]', { timeout: 15000 })
await page.waitForTimeout(1200)
await page.click('button[aria-label="Créer"]')
await page.waitForTimeout(1800)
const apres = await page.innerText('body')
verifier('aucun choix « Créer un Coffre » ne s’ouvre', !/coffre/i.test(apres),
  (apres.match(/.{0,35}coffre.{0,35}/i) || [''])[0])
verifier('on arrive sur la création de carte', page.url().includes('/app/cartes/nouvelle'), `→ ${page.url()}`)

console.log('\nLes anciennes adresses ne mènent plus à un coffre')
for (const route of ['/app/coffres', '/app/coffres/nouveau', '/coffre/abc', '/vault/abc', '/c/abc']) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  const chemin = new URL(page.url()).pathname
  const texte = await page.innerText('body')
  verifier(`${route} → ${chemin}`, !/coffre|déverrouill/i.test(texte))
}

await browser.close()
console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nAucune trace du coffre dans l’application.')
process.exit(echecs.length ? 1 : 0)
