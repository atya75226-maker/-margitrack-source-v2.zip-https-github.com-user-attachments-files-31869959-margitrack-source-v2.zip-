/**
 * Comportement de la session hors réseau, et composition de la barre du bas
 * (Playwright).
 *
 *   npm run build && npm run preview -- --port 4173
 *   npm install --no-save playwright        # chromium déjà installé sinon
 *   node scripts/session-check.mjs          # ou BASE_URL=... node scripts/session-check.mjs
 *
 * Aucun accès à Supabase n'est nécessaire : le test coupe justement toutes les
 * requêtes vers le serveur d'authentification pour reproduire ce qui arrivait
 * aux utilisateurs — une session parfaitement valable, un renouvellement de
 * jeton qui échoue, et l'application qui réclamait un nouveau mot de passe.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const KEY = 'sb-wadapjshbdjkjrfnsnyr-auth-token'

function sessionRangee({ expiresInSeconds }) {
  return {
    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0In0.x',
    refresh_token: 'refresh-token-de-test',
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    expires_in: Math.max(0, expiresInSeconds),
    token_type: 'bearer',
    user: {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'awa@example.com',
      user_metadata: { first_name: 'Awa', last_name: 'Diallo' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
  }
}

const echecs = []
function verifier(nom, condition, detail = '') {
  if (condition) console.log(`  ok   ${nom}`)
  else {
    console.log(`  ÉCHEC ${nom}${detail ? ` ${detail}` : ''}`)
    echecs.push(nom)
  }
}

const browser = await chromium.launch()

/**
 * Onglet neuf, session préchargée, serveur d'authentification injoignable.
 *
 * La session est déposée par storageState, et non par un script d'injection :
 * un script d'injection se rejouerait à chaque navigation et réécrirait la
 * session juste après l'avoir effacée, ce qui rendrait le test de déconnexion
 * impossible à faire échouer.
 */
async function ouvrir(seed, { width = 412, height = 915 } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    storageState: seed
      ? { cookies: [], origins: [{ origin: BASE, localStorage: [{ name: KEY, value: JSON.stringify(seed) }] }] }
      : undefined,
  })
  await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))
  const page = await context.newPage()
  return { page, context }
}

console.log('\nJeton périmé, réseau coupé — la session ne doit pas être perdue')
{
  const { page, context } = await ouvrir(sessionRangee({ expiresInSeconds: -3600 }))
  await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4500)
  const texte = await page.innerText('body')
  verifier("l'écran de reconnexion s'affiche", /Reconnexion/i.test(texte), `→ ${texte.slice(0, 90)}`)
  verifier("le mot de passe n'est pas réclamé", !/Mot de passe oublié/i.test(texte))
  verifier("l'adresse reste celle demandée", new URL(page.url()).pathname === '/app', `→ ${page.url()}`)

  // L'explication n'arrive qu'après douze secondes : une reprise réussie est
  // bien plus rapide, et annoncer une panne plus tôt pousse à recharger la
  // page — ce qui fait justement perdre le jeton en cours de renouvellement.
  await page.waitForTimeout(9000)
  const tardif = await page.innerText('body')
  verifier("l'explication finit par apparaître", /réseau qui manque/i.test(tardif))
  verifier('le bouton ne recharge pas la page', /Réessayer maintenant/i.test(tardif))
  await context.close()
}

console.log('\nCoffre scanné sans réseau — ni déconnexion, ni document')
{
  // Le coffre ne dépend plus du compte : la page ne doit donc jamais réclamer
  // une connexion, et ne doit pas non plus prétendre que le coffre n'existe pas
  // alors que c'est le réseau qui manque.
  for (const prefixe of ['coffre', 'vault', 'c']) {
    const { page, context } = await ouvrir(null)
    await page.goto(`${BASE}/${prefixe}/22222222-2222-2222-2222-222222222222`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    const texte = await page.innerText('body')
    verifier(`/${prefixe}/ : aucune connexion réclamée`, !/Se connecter|Mot de passe oublié/i.test(texte),
      `→ ${texte.slice(0, 90)}`)
    verifier(`/${prefixe}/ : panne de réseau annoncée, pas une absence de coffre`,
      /pas joignable|réessayer/i.test(texte), `→ ${texte.slice(0, 90)}`)
    verifier(`/${prefixe}/ : aucun fichier montré`, !/Accès autorisé/i.test(texte))
    await context.close()
  }
}

console.log('\nJeton encore valable, réseau coupé — ouverture immédiate')
{
  const { page, context } = await ouvrir(sessionRangee({ expiresInSeconds: 1800 }))
  await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('nav a[aria-label="Accueil"]', { timeout: 8000 }).catch(() => null)
  const texte = await page.innerText('body')
  verifier('le tableau de bord est affiché', /tableau de bord/i.test(texte), `→ ${texte.slice(0, 90)}`)

  const barre = page.locator('nav').last()
  const libelles = await barre.locator('[aria-label]').evaluateAll((n) => n.map((e) => e.getAttribute('aria-label')))
  verifier('six emplacements dans la barre du bas', libelles.length === 6, `→ ${libelles.join(', ')}`)
  verifier('« Créer » est descendu dans la barre', libelles.includes('Créer'))
  verifier('« Scanner » y figure', libelles.includes('Scanner'))
  verifier('« Profil » n\'y figure plus', !libelles.includes('Profil'), `→ ${libelles.join(', ')}`)

  const entete = page.locator('header').first()
  const creerEnHaut = await entete.locator('[aria-label="Créer"]').count()
  verifier('plus aucun bouton « Créer » dans l\'entête', creerEnHaut === 0)
  verifier('la photo de compte reste en haut', (await entete.locator('a[href="/app/profil"]').count()) > 0)
  await context.close()
}

console.log('\nStockage local refusé — les cookies prennent le relais')
{
  // Reproduit un WebView Android dont le stockage DOM est désactivé : c'est la
  // configuration qui faisait perdre la session au moindre rechargement.
  const context = await browser.newContext({ viewport: { width: 412, height: 915 } })
  await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))
  const page = await context.newPage()
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('storage is disabled', 'SecurityError') },
    })
  })
  await page.addInitScript(
    ([key, valeur]) => {
      document.cookie = `${key}=${encodeURIComponent(valeur)}; path=/; max-age=31536000; SameSite=Lax`
    },
    [KEY, JSON.stringify(sessionRangee({ expiresInSeconds: 1800 }))],
  )

  await page.goto(`${BASE}/diagnostic`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const diagnostic = await page.innerText('body')
  verifier('le repli cookies est annoncé', /cookies \(repli\)/.test(diagnostic), `→ ${diagnostic.slice(0, 120)}`)
  verifier('les jetons sont retrouvés', /Jetons présents sur l'appareil\s*oui/.test(diagnostic.replace(/\n/g, ' ')))

  await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const app = await page.innerText('body')
  verifier('la session survit sans stockage local', /tableau de bord/i.test(app), `→ ${app.slice(0, 90)}`)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const apres = await page.innerText('body')
  verifier('elle survit aussi au rechargement', /tableau de bord/i.test(apres), `→ ${apres.slice(0, 90)}`)
  await context.close()
}

console.log('\nLes quatre cas demandés')
{
  const { page, context } = await ouvrir(sessionRangee({ expiresInSeconds: 1800 }))

  // Test 1 — connexion puis actualisation de la page.
  await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  verifier('1. actualisation : toujours dans l\'application',
    /tableau de bord/i.test(await page.innerText('body')) && new URL(page.url()).pathname === '/app',
    `→ ${page.url()}`)

  // Test 2 — retour sur le site après fermeture : un onglet neuf, même stockage.
  const onglet = await context.newPage()
  await onglet.goto(BASE, { waitUntil: 'domcontentloaded' })
  await onglet.waitForTimeout(1800)
  verifier('2. retour sur l\'adresse du site : pas de page vitrine',
    new URL(onglet.url()).pathname === '/app', `→ ${onglet.url()}`)
  verifier('2. le tableau de bord est bien affiché', /tableau de bord/i.test(await onglet.innerText('body')))

  // Test 3 — navigation dans plusieurs pages puis actualisation.
  await page.goto(`${BASE}/app/coffres`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  await page.goto(`${BASE}/app/statistiques`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  verifier('3. actualisation en cours de navigation : aucune redirection',
    new URL(page.url()).pathname === '/app/statistiques', `→ ${page.url()}`)

  // La page de connexion n'a plus lieu d'être quand la session est ouverte.
  await page.goto(`${BASE}/connexion`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  verifier('/connexion renvoie vers l\'application',
    new URL(page.url()).pathname === '/app', `→ ${page.url()}`)

  // Test 4 — déconnexion volontaire : le stockage est vidé, comme le fait
  // signOut(). Là, et seulement là, le retour à l'accueil est normal.
  await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => window.localStorage.clear())
  await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  verifier('4. déconnexion volontaire : retour à la connexion',
    new URL(page.url()).pathname === '/connexion', `→ ${page.url()}`)

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  verifier('4. la page vitrine redevient accessible une fois déconnecté',
    new URL(page.url()).pathname === '/' && /Kartaa/i.test(await page.innerText('body')), `→ ${page.url()}`)
  await context.close()
}

console.log('\nAucun jeton rangé — la connexion est bien réclamée')
{
  const { page, context } = await ouvrir(null)
  await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  verifier('redirection vers /connexion', new URL(page.url()).pathname === '/connexion', `→ ${page.url()}`)
  await context.close()
}

await browser.close()
console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nTout est conforme.')
process.exit(echecs.length ? 1 : 0)
