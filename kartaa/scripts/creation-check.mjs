/**
 * Création d'un coffre avec sécurité renforcée (Playwright + capteur virtuel).
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/creation-check.mjs
 *
 * Reproduit le parcours complet et vérifie qu'il n'est JAMAIS interrompu :
 * nom, mot de passe, activation de l'empreinte, code de récupération affiché,
 * confirmation, ouverture du coffre.
 *
 * Deux situations, parce que c'est la seconde qui casse en vrai : le capteur
 * accepte, et le capteur refuse.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const KEY = 'sb-wadapjshbdjkjrfnsnyr-auth-token'
const COMPTE = '11111111-1111-1111-1111-111111111111'
const COFFRE = '77777777-7777-7777-7777-777777777777'

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

const json = (route, corps) => route.fulfill({
  status: 200, contentType: 'application/json',
  headers: { 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(corps),
})

async function scenario({ capteurAccepte }) {
  console.log(`\nCréation avec sécurité renforcée — capteur qui ${capteurAccepte ? 'accepte' : 'refuse'}`)

  let coffreCree = false
  let biometrieEnregistree = false

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 420, height: 950 },
    storageState: { cookies: [], origins: [{ origin: BASE, localStorage: [{ name: KEY, value: JSON.stringify(session) }] }] },
  })

  await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))
  await context.route('**/rest/v1/profiles*', (route) => json(route, {
    id: COMPTE, first_name: 'Awa', last_name: 'Diallo', email: 'awa@example.com',
    phone: '', avatar_url: '', plan: 'free',
  }))
  await context.route('**/rest/v1/cards*', (route) => json(route, []))
  await context.route('**/rest/v1/vault_files*', (route) => json(route, []))
  await context.route('**/rest/v1/vault_access_log*', (route) => json(route, []))
  await context.route('**/rest/v1/vaults*', (route) => {
    const ligne = {
      id: COFFRE, user_id: COMPTE, name: 'Mes souvenirs',
      protection: biometrieEnregistree ? 'password+biometric' : 'password',
      folders: [], failed_attempts: 0, locked_until: null, last_opened_at: null,
      recovery_issued_at: null, recovery_used_at: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    // « user_id=eq. » contient « id=eq. » : on teste la liste en premier.
    const url = route.request().url()
    if (url.includes('user_id=eq.')) return json(route, coffreCree ? [ligne] : [])
    if (url.includes('id=eq.')) return json(route, coffreCree ? ligne : null)
    return json(route, [])
  })
  await context.route('**/rest/v1/rpc/**', (route) => {
    const nom = new URL(route.request().url()).pathname.split('/').pop()
    if (nom === 'vault_create') {
      coffreCree = true
      return json(route, COFFRE)
    }
    if (nom === 'vault_set_biometric') {
      biometrieEnregistree = true
      return json(route, null)
    }
    return json(route, null)
  })

  const page = await context.newPage()

  // Toute erreur non rattrapée doit être visible : c'est précisément ce qu'on cherche.
  const erreurs = []
  page.on('pageerror', (erreur) => erreurs.push(`pageerror: ${erreur.message}\n${(erreur.stack || '').split('\n').slice(0, 4).join('\n')}`))
  page.on('console', (message) => {
    if (message.type() === 'error') erreurs.push(`console: ${message.text()}`)
  })

  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal',
      hasResidentKey: true, hasUserVerification: true, hasPrf: true,
      automaticPresenceSimulation: true,
      // Un capteur qui refuse : l'empreinte n'est pas reconnue.
      isUserVerified: capteurAccepte,
    },
  })

  await page.goto(`${BASE}/app/coffres/nouveau`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Nom du coffre', { timeout: 20000 })
  await page.fill('input[placeholder="Mes souvenirs"]', 'Mes souvenirs')
  await page.click('button:has-text("Continuer")')

  await page.waitForSelector('text=Mot de passe du coffre', { timeout: 20000 })
  const mots = page.locator('input[type=password]')
  await mots.nth(0).fill('MonCoffre2026')
  await mots.nth(1).fill('MonCoffre2026')

  const bascule = page.locator('button:has-text("Ajouter le déverrouillage biométrique")')
  verifier('la sécurité renforcée est proposée', (await bascule.count()) > 0)
  await bascule.click()

  await page.click('button:has-text("Protéger mon coffre")')

  // Le point qui compte : arrive-t-on au code de récupération ?
  const arrive = await page
    .waitForSelector('text=Code de récupération', { timeout: 60000 })
    .then(() => true)
    .catch(() => false)

  verifier('le code de récupération est affiché', arrive, `→ url ${page.url()}`)
  verifier("l'application n'a pas quitté le parcours", page.url().includes('/app/coffres/nouveau'),
    `→ ${page.url()}`)

  if (arrive) {
    const code = (await page.locator('p.font-mono').first().textContent()) || ''
    verifier('le code a bien la forme attendue', /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code.trim()),
      `→ « ${code.trim()} »`)
    verifier("le code est affiché avant que l'empreinte soit demandée", biometrieEnregistree === false)

    await page.check('input[type=checkbox]')
    await page.click("button:has-text(\"J'ai conservé mon code\")")

    // L'empreinte n'est demandée qu'ici, le code désormais sauvegardé.
    const etapeEmpreinte = await page
      .waitForSelector('text=Dernière étape', { timeout: 20000 })
      .then(() => true)
      .catch(() => false)
    verifier("l'empreinte est demandée après le code", etapeEmpreinte)

    await page.click('button:has-text("Activer la sécurité renforcée")')

    if (capteurAccepte) {
      const ouvert = await page
        .waitForSelector('text=Coffre déverrouillé', { timeout: 30000 })
        .then(() => true)
        .catch(() => false)
      verifier('le coffre s’ouvre après activation', ouvert, `→ ${page.url()}`)
      verifier("l'empreinte est bien enregistrée", biometrieEnregistree)
    } else {
      // Un capteur qui refuse doit produire une erreur lisible, pas une sortie.
      const message = await page
        .waitForSelector("text=Impossible d'activer la sécurité renforcée", { timeout: 40000 })
        .then(() => true)
        .catch(() => false)
      verifier("l'échec affiche une erreur compréhensible", message)
      verifier('rien n’a été supprimé, le message le dit',
        (await page.locator("text=Vos données n'ont pas été supprimées").count()) > 0)
      verifier("l'application reste sur l'écran de création", page.url().includes('/app/coffres/nouveau'),
        `→ ${page.url()}`)
      verifier('un nouvel essai est proposé', (await page.locator('button:has-text("Réessayer")').count()) > 0)

      await page.click("button:has-text(\"Ouvrir mon coffre sans\")")
      const ouvert = await page
        .waitForSelector('text=Coffre déverrouillé', { timeout: 30000 })
        .then(() => true)
        .catch(() => false)
      verifier('le coffre reste accessible malgré l’échec', ouvert, `→ ${page.url()}`)
      verifier("aucune empreinte n'a été enregistrée", biometrieEnregistree === false)
    }
  }

  if (erreurs.length) console.log(`  (journal) ${erreurs.slice(0, 4).join(' | ')}`)

  await browser.close()
}

await scenario({ capteurAccepte: true })
await scenario({ capteurAccepte: false })

console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nTout est conforme.')
process.exit(echecs.length ? 1 : 0)
