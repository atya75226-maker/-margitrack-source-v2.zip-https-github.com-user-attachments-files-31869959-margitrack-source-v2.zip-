/**
 * Photo du compte reprise par la carte (Playwright).
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/photo-check.mjs
 *
 * Le compte possède une photo, la carte n'en a aucune qui lui soit propre :
 * elle doit donc afficher celle du compte. Le test suit ensuite tout le cycle —
 * ajout, changement, suppression — sans jamais recharger la page, parce que
 * c'est précisément ce qui manquait : la photo était bien enregistrée dans le
 * compte, mais la carte ne la lisait pas.
 */
import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

/** Deux photos de couleurs franches : on reconnaît celle qui s'affiche au pixel près. */
function imageUnie(r, g, b) {
  const png = new PNG({ width: 220, height: 220 })
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r
    png.data[i + 1] = g
    png.data[i + 2] = b
    png.data[i + 3] = 255
  }
  return PNG.sync.write(png)
}

const COULEURS = [
  { nom: 'rose', octets: imageUnie(255, 0, 255), test: (p) => p[0] > 230 && p[1] < 40 && p[2] > 230 },
  { nom: 'vert', octets: imageUnie(0, 255, 0), test: (p) => p[0] < 40 && p[1] > 230 && p[2] < 40 },
]

const dossier = mkdtempSync(join(tmpdir(), 'kartaa-photo-'))
const fichiers = COULEURS.map((couleur, index) => {
  const chemin = join(dossier, `${couleur.nom}.png`)
  writeFileSync(chemin, couleur.octets)
  return { ...couleur, chemin, index }
})

const carte = {
  id: CARTE,
  user_id: COMPTE,
  slug: 'awa-diallo',
  template: 'standard',
  theme: { primary: '#6d28d9', accent: '#f5b229', font: 'sans', layout: 'left' },
  // Aucune photo propre à la carte : tout doit venir du compte.
  profile: {
    firstName: 'Awa', lastName: 'Diallo', profession: 'Architecte',
    phone: '+225 07 00 12 34 56', email: 'awa@example.com',
  },
  about: '', activities: [], companies: [], services: [], gallery: [], socials: {},
  scans: 3, custom_domain: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
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

const json = (route, corps) => route.fulfill({
  status: 200,
  contentType: 'application/json',
  headers: { 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(corps),
})

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1280, height: 1000 },
  storageState: { cookies: [], origins: [{ origin: BASE, localStorage: [{ name: KEY, value: JSON.stringify(session()) }] }] },
})

// État du compte côté « serveur » : c'est lui qui doit piloter l'affichage.
let avatarUrl = ''
const couleurParChemin = new Map()
let televersements = 0

await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))

// Téléversement : on retient quelle couleur a été envoyée, pour la resservir ensuite.
await context.route('**/storage/v1/object/card-assets/**', (route) => {
  const url = new URL(route.request().url())
  if (route.request().method() === 'DELETE') return json(route, [])
  const chemin = url.pathname.split('/card-assets/')[1]
  couleurParChemin.set(chemin, fichiers[Math.min(televersements, fichiers.length - 1)])
  televersements += 1
  return json(route, { Key: chemin })
})

// Lecture publique de l'image téléversée.
await context.route('**/storage/v1/object/public/card-assets/**', (route) => {
  const chemin = new URL(route.request().url()).pathname.split('/card-assets/')[1]
  const couleur = couleurParChemin.get(chemin) || fichiers[0]
  return route.fulfill({
    status: 200,
    contentType: 'image/png',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: couleur.octets,
  })
})

await context.route('**/rest/v1/profiles*', (route) => {
  if (route.request().method() === 'PATCH') {
    const corps = JSON.parse(route.request().postData() || '{}')
    if (corps.avatar_url !== undefined) avatarUrl = corps.avatar_url
  }
  return json(route, {
    id: COMPTE, first_name: 'Awa', last_name: 'Diallo', email: 'awa@example.com',
    phone: '', avatar_url: avatarUrl, plan: 'pro',
  })
})
await context.route('**/auth/v1/user*', (route) => json(route, session().user))
await context.route('**/rest/v1/cards*', (route) => json(route, carte))
await context.route('**/rest/v1/social_links*', (route) => json(route, []))
await context.route('**/rest/v1/card_scans*', (route) => json(route, []))
await context.route('**/rest/v1/vaults*', (route) => json(route, []))
await context.route('**/rest/v1/rpc/card_by_slug*', (route) => json(route, {
  id: CARTE, slug: carte.slug, template: carte.template, theme: carte.theme,
  profile: carte.profile, socials: {}, about: '', activities: [], companies: [],
  services: [], gallery: [], scans: 3, createdAt: carte.created_at,
  ownerPlan: 'pro', ownerAvatarUrl: avatarUrl, socialLinks: [],
}))

const page = await context.newPage()

/** Couleur réellement peinte par la photo au centre de la pastille du verso. */
async function couleurDeLaPhotoDuVerso() {
  await page.goto(`${BASE}/app/cartes/${CARTE}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Verso', { timeout: 15000 })
  await page.click('button:has-text("Verso")')
  await page.waitForTimeout(1200)
  const photo = page.locator('.shadow-lift img[alt=""]').first()
  if (!(await photo.count())) return null
  const capture = PNG.sync.read(await photo.screenshot())
  const milieu = (capture.height >> 1) * capture.width * 4 + (capture.width >> 1) * 4
  const pixel = [capture.data[milieu], capture.data[milieu + 1], capture.data[milieu + 2]]
  return fichiers.find((f) => f.test(pixel))?.nom || `inconnue(${pixel.join(',')})`
}

async function deposerPhoto(fichier) {
  await page.goto(`${BASE}/app/profil`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Ma photo', { timeout: 15000 })
  await page.setInputFiles('input[type=file]', fichier.chemin)
  await page.waitForSelector('text=Photo mise à jour', { timeout: 15000 })
}

console.log('\nCas 1 — le compte a une photo, la carte n’en a pas')
await deposerPhoto(fichiers[0])
verifier('la photo est enregistrée sur le compte', avatarUrl.includes('card-assets'), `→ ${avatarUrl || '(vide)'}`)
verifier('la carte reprend la photo du compte', (await couleurDeLaPhotoDuVerso()) === 'rose')

console.log('\nCas 2 — la photo change')
await deposerPhoto(fichiers[1])
verifier('la carte montre la nouvelle photo, sans rechargement', (await couleurDeLaPhotoDuVerso()) === 'vert')

console.log('\nCas 3 — la photo est retirée')
await page.goto(`${BASE}/app/profil`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Ma photo', { timeout: 15000 })
await page.click('button:has-text("Retirer")')
await page.waitForSelector('text=Photo retirée', { timeout: 15000 })
verifier('le compte n’a plus de photo', avatarUrl === '', `→ ${avatarUrl || '(vide)'}`)
verifier('la carte n’affiche plus aucune photo', (await couleurDeLaPhotoDuVerso()) === null)

console.log('\nLe mini-site public affiche la photo du propriétaire')
await deposerPhoto(fichiers[0])
const visiteur = await browser.newContext({ viewport: { width: 420, height: 900 } })
await visiteur.route('**://*.supabase.co/**', (route) => route.abort('failed'))
await visiteur.route('**/storage/v1/object/public/card-assets/**', (route) => route.fulfill({
  status: 200, contentType: 'image/png',
  headers: { 'Access-Control-Allow-Origin': '*' },
  body: fichiers[0].octets,
}))
// La dernière route enregistrée l'emporte : le fourre-tout passe donc avant.
await visiteur.route('**/rest/v1/rpc/**', (route) => json(route, null))
await visiteur.route('**/rest/v1/rpc/card_by_slug*', (route) => json(route, {
  id: CARTE, slug: carte.slug, template: carte.template, theme: carte.theme,
  profile: carte.profile, socials: {}, about: '', activities: [], companies: [],
  services: [], gallery: [], scans: 3, createdAt: carte.created_at,
  ownerPlan: 'pro', ownerAvatarUrl: avatarUrl, socialLinks: [],
}))
const pagePublique = await visiteur.newPage()
await pagePublique.goto(`${BASE}/${carte.slug}`, { waitUntil: 'domcontentloaded' })
await pagePublique.waitForSelector('text=Awa Diallo', { timeout: 15000 })
await pagePublique.waitForTimeout(800)
const portrait = pagePublique.locator('header img').first()
verifier('la photo du compte s’affiche sur le mini-site', await portrait.count() > 0)

await browser.close()
console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nTout est conforme.')
process.exit(echecs.length ? 1 : 0)
