/**
 * Cartes NFC (Playwright).
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/nfc-check.mjs
 *
 * Une puce NFC ne contient qu'une adresse : celle du mini-site. Ce contrôle
 * vérifie que c'est bien cette adresse-là qui est écrite — la vraie, celle du
 * domaine de référence — et pas une autre.
 *
 * Il joue surtout les deux mondes, parce que les deux existent :
 *
 *   • un navigateur qui sait écrire (Chrome sur Android) : le bouton est là et
 *     écrit réellement ;
 *   • un navigateur qui ne sait pas (iPhone, ordinateur) : aucun bouton mort,
 *     mais l'adresse à inscrire et l'explication de la limite.
 *
 * Web NFC n'existe pas dans le Chromium de test : on installe donc un faux
 * `NDEFReader` qui note ce qu'on lui demande d'écrire. Ce qui est vérifié, ce
 * n'est pas l'API du navigateur — c'est ce que Kartaa lui donne.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const KEY = 'sb-wadapjshbdjkjrfnsnyr-auth-token'
const CARTE = '33333333-3333-3333-3333-333333333333'
const COMPTE = '11111111-1111-1111-1111-111111111111'
const ADRESSE_ATTENDUE = 'https://kartaa-eight.vercel.app/awa-diallo'

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
  profile: { firstName: 'Awa', lastName: 'Diallo', profession: 'Architecte', phone: '+225 07 00 12 34 56', email: 'awa@example.com' },
  about: '', activities: [], companies: [], services: [], gallery: [], socials: {},
  scans: 3, custom_domain: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
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
  headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(corps),
})

const browser = await chromium.launch()

/** Un contexte connecté ; `avecNfc` installe le faux lecteur de puces. */
async function ouvrir({ avecNfc }) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 900 }, locale: 'fr-FR',
    storageState: { cookies: [], origins: [{ origin: BASE, localStorage: [{ name: KEY, value: JSON.stringify(session) }] }] },
  })
  await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))
  await context.route('**/rest/v1/**', (route) => json(route, []))
  await context.route('**/rest/v1/profiles*', (route) => json(route, {
    id: COMPTE, first_name: 'Awa', last_name: 'Diallo', email: 'awa@example.com',
    phone: '', avatar_url: '', plan: 'free',
  }))
  await context.route('**/rest/v1/cards*', (route) => json(route, carte))
  await context.route('**/rest/v1/card_media*', (route) => {
    if (route.request().method() === 'POST') {
      const corps = JSON.parse(route.request().postData() || '{}')
      return json(route, { id: 'm1', card_id: CARTE, kind: corps.kind, label: corps.label, serial: corps.serial, status: corps.status })
    }
    return json(route, [])
  })

  if (avecNfc) {
    await context.addInitScript(() => {
      window.__nfc = { ecrits: [] }
      class NDEFReader {
        async write(message) {
          window.__nfc.ecrits.push(message)
          return true
        }

        async scan() {
          return true
        }
      }
      window.NDEFReader = NDEFReader
    })
  }

  const page = await context.newPage()
  return { page, context }
}

/* ------------------------------------------- un navigateur qui sait écrire */

console.log('\nSur un téléphone qui sait écrire les puces')
{
  const { page, context } = await ouvrir({ avecNfc: true })
  await page.goto(`${BASE}/app/cartes/${CARTE}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Ma carte NFC', { timeout: 20000 })
  await page.waitForTimeout(1200)

  const texte = await page.innerText('body')
  verifier('la carte NFC est proposée', /Ma carte NFC/.test(texte))
  verifier('ce que contient la puce est expliqué',
    /ne contient qu'une adresse|ne contient qu’une adresse/i.test(texte))
  verifier('le bouton d’écriture est présent',
    (await page.locator('button:has-text("Programmer ma carte NFC")').count()) === 1)

  await page.click('button:has-text("Programmer ma carte NFC")')
  await page.waitForTimeout(600)
  verifier('l’adresse à écrire est montrée avant d’écrire',
    (await page.innerText('body')).includes(ADRESSE_ATTENDUE))

  await page.click('button:has-text("Écrire")')
  await page.waitForTimeout(1500)

  const ecrits = await page.evaluate(() => window.__nfc.ecrits)
  verifier('une seule écriture a eu lieu', ecrits.length === 1, `→ ${ecrits.length}`)
  const enregistrement = ecrits[0]?.records?.[0]
  verifier('la puce reçoit une adresse, pas du texte libre',
    enregistrement?.recordType === 'url', `→ ${enregistrement?.recordType}`)
  verifier('c’est bien l’adresse publique de la carte',
    enregistrement?.data === ADRESSE_ATTENDUE, `→ ${enregistrement?.data}`)
  verifier('aucune donnée personnelle n’est écrite sur la puce',
    !JSON.stringify(ecrits).includes('07 00 12 34 56') && !JSON.stringify(ecrits).includes('awa@example.com'))

  const apres = await page.innerText('body')
  verifier('la réussite est annoncée', /programmée/i.test(apres), `→ ${apres.slice(0, 120)}`)

  // Le scanner sait aussi lire une puce là où le navigateur le permet.
  await page.goto(`${BASE}/app/scanner`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  verifier('le scanner propose la lecture NFC',
    (await page.locator('button:has-text("Lire une carte NFC")').count()) === 1)
  await context.close()
}

/* ---------------------------------------- un navigateur qui ne sait pas écrire */

console.log('\nSur un appareil qui ne sait pas écrire (iPhone, ordinateur)')
{
  const { page, context } = await ouvrir({ avecNfc: false })
  await page.goto(`${BASE}/app/cartes/${CARTE}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Ma carte NFC', { timeout: 20000 })
  await page.waitForTimeout(1200)

  const texte = await page.innerText('body')
  verifier('aucun bouton qui ne ferait rien',
    (await page.locator('button:has-text("Programmer ma carte NFC")').count()) === 0)
  verifier('la limite est expliquée', /Chrome|iOS|iPhone|Android/i.test(texte))
  verifier('l’adresse à inscrire est donnée', texte.includes(ADRESSE_ATTENDUE))
  verifier('on dit que la puce fonctionnera quand même partout',
    /fonctionne partout|sans aucune application/i.test(texte))

  await page.goto(`${BASE}/app/scanner`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  verifier('le scanner ne propose pas une lecture impossible',
    (await page.locator('button:has-text("Lire une carte NFC")').count()) === 0)
  await context.close()
}

/* ------------------------------------------------------------- la vitrine */

console.log('\nCe que la vitrine en dit')
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'fr-FR' })
  await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))
  const page = await context.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Comment ça marche', { timeout: 20000 })
  await page.waitForTimeout(1500)
  const texte = await page.innerText('body')

  verifier('le NFC est annoncé', /NFC/.test(texte))
  verifier('la limite de l’écriture est dite', /Chrome sur Android/i.test(texte),
    `→ ${texte.match(/.{0,80}Android.{0,80}/)?.[0] || 'absent'}`)
  verifier('on n’annonce pas de carte NFC vendue par Kartaa',
    !/commandez votre carte NFC|nos cartes NFC/i.test(texte))
  await context.close()
}

await browser.close()
console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nTout est conforme.')
process.exit(echecs.length ? 1 : 0)
