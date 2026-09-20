/**
 * Ce qui se passe après une déconnexion (Playwright).
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/deconnexion-check.mjs
 *
 * Se déconnecter ne doit pas laisser quelqu'un devant une porte close : on
 * revient sur la page d'accueil, et les deux chemins — se reconnecter, ou
 * ouvrir un autre compte — sont visibles tout de suite.
 *
 * Le cas de l'application installée est joué à part. Elle suit une règle
 * particulière : lancée depuis son icône, elle ne s'ouvre pas sur la page
 * vitrine. Cette règle ne doit pas rendre l'accueil inatteignable pour autant —
 * une déconnexion, ou le bouton « Retour à l'accueil », doivent l'emporter.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const KEY = 'sb-wadapjshbdjkjrfnsnyr-auth-token'
const COMPTE = '11111111-1111-1111-1111-111111111111'

/** Le bouton de retour, quelle que soit l'apostrophe utilisée par le rendu. */
const retourAccueil = (page) => page.getByRole('link', { name: /Retour à l.accueil/ }).first()

const echecs = []
function verifier(nom, condition, detail = '') {
  if (condition) console.log(`  ok   ${nom}`)
  else {
    console.log(`  ÉCHEC ${nom}${detail ? ` ${detail}` : ''}`)
    echecs.push(nom)
  }
}

const session = () => ({
  access_token: 'a.b.c', refresh_token: 'r',
  expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
  user: {
    id: COMPTE, email: 'awa@example.com',
    user_metadata: { first_name: 'Awa', last_name: 'Diallo' },
    app_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
  },
})

const json = (route, corps) => route.fulfill({
  status: 200, contentType: 'application/json',
  headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(corps),
})

const browser = await chromium.launch()

/** Un contexte connecté, avec le serveur simulé. */
async function ouvrir({ installee = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 900 },
    locale: 'fr-FR',
    storageState: { cookies: [], origins: [{ origin: BASE, localStorage: [{ name: KEY, value: JSON.stringify(session()) }] }] },
  })
  await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))
  await context.route('**/rest/v1/**', (route) => json(route, []))
  await context.route('**/rest/v1/profiles*', (route) => json(route, {
    id: COMPTE, first_name: 'Awa', last_name: 'Diallo', email: 'awa@example.com',
    phone: '', avatar_url: '', plan: 'free',
  }))
  await context.route('**/rest/v1/cards*', (route) => json(route, []))
  await context.route('**/auth/v1/logout*', (route) => route.fulfill({ status: 204, body: '' }))
  if (installee) {
    // Ce que voit l'application posée sur l'écran d'accueil : une fenêtre
    // autonome. C'est ce signal, et rien d'autre, qui la distingue.
    await context.addInitScript(() => {
      const vrai = window.matchMedia.bind(window)
      window.matchMedia = (requete) => (
        requete.includes('display-mode: standalone')
          ? { matches: true, media: requete, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
          : vrai(requete)
      )
    })
  }
  const page = await context.newPage()
  return { page, context }
}

/* ------------------------------------------------- dans le navigateur */

console.log('\nDans un navigateur')
{
  const { page, context } = await ouvrir()
  await page.goto(`${BASE}/app/profil`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Se déconnecter', { timeout: 20000 })
  await page.click('button:has-text("Se déconnecter")')
  await page.waitForTimeout(2500)

  verifier('la déconnexion ramène à la page d’accueil',
    new URL(page.url()).pathname === '/', `→ ${page.url()}`)

  const texte = await page.innerText('body')
  verifier('la déconnexion est annoncée', /Vous êtes déconnecté/i.test(texte))
  // Visibles à l'écran, pas seulement présents dans le document : un bouton
  // caché derrière un menu ne répond pas à la question « et maintenant ? ».
  const bandeau = page.locator('a:visible')
  verifier('« Se connecter » est proposé', (await bandeau.filter({ hasText: 'Se connecter' }).count()) > 0)
  verifier('« Créer un compte » est proposé', (await bandeau.filter({ hasText: 'Créer un compte' }).count()) > 0)
  verifier('la page d’accueil est bien celle du produit', /Comment ça marche/i.test(texte))

  await page.locator('a:visible').filter({ hasText: 'Se connecter' }).first().click()
  await page.waitForTimeout(1500)
  verifier('« Se connecter » mène à la connexion',
    new URL(page.url()).pathname === '/connexion', `→ ${page.url()}`)

  // Et de là, on doit pouvoir revenir en arrière.
  await retourAccueil(page).click()
  await page.waitForTimeout(1500)
  verifier('« Retour à l’accueil » ramène à la page d’accueil',
    new URL(page.url()).pathname === '/' && /Comment ça marche/i.test(await page.innerText('body')),
    `→ ${page.url()}`)
  await context.close()
}

/* --------------------------------------------- application installée */

console.log('\nDepuis l’application installée')
{
  const { page, context } = await ouvrir({ installee: true })

  // La règle d'ouverture reste : lancée sans session, elle va à la connexion.
  await page.evaluate(() => null).catch(() => null)
  await page.goto(`${BASE}/app/profil`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Se déconnecter', { timeout: 20000 })
  await page.click('button:has-text("Se déconnecter")')
  await page.waitForTimeout(2500)

  verifier('la déconnexion ramène aussi à la page d’accueil',
    new URL(page.url()).pathname === '/', `→ ${page.url()}`)
  verifier('la page d’accueil s’affiche vraiment',
    /Comment ça marche/i.test(await page.innerText('body')))

  // Rouverte depuis son icône, sans session : la connexion, pas le marketing.
  // Une page neuve, parce qu'un onglet qui vient de servir garde l'état de son
  // historique — et c'est justement cet état qui autorise l'accueil.
  const relancee = await context.newPage()
  await relancee.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await relancee.waitForTimeout(2000)
  verifier('lancée depuis son icône, elle ouvre toujours la connexion',
    new URL(relancee.url()).pathname === '/connexion', `→ ${relancee.url()}`)

  // Mais l'accueil reste atteignable depuis cet écran.
  await retourAccueil(relancee).click()
  await relancee.waitForTimeout(1800)
  verifier('« Retour à l’accueil » fonctionne depuis l’application installée',
    new URL(relancee.url()).pathname === '/' && /Comment ça marche/i.test(await relancee.innerText('body')),
    `→ ${relancee.url()}`)
  await context.close()
}

await browser.close()
console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nTout est conforme.')
process.exit(echecs.length ? 1 : 0)
