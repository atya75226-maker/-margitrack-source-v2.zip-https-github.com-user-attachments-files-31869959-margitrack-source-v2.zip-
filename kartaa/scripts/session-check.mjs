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

/** Onglet neuf, session préchargée, serveur d'authentification injoignable. */
async function ouvrir(seed, { width = 412, height = 915 } = {}) {
  const context = await browser.newContext({ viewport: { width, height } })
  await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))
  const page = await context.newPage()
  await page.addInitScript(
    ([key, valeur]) => {
      if (valeur) window.localStorage.setItem(key, valeur)
      else window.localStorage.removeItem(key)
    },
    [KEY, seed ? JSON.stringify(seed) : null],
  )
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
  verifier("l'explication et le bouton finissent par apparaître", /réseau qui manque/i.test(texte))
  await context.close()
}

console.log('\nCoffre scanné, jeton périmé — ni déconnexion, ni document')
{
  const { page, context } = await ouvrir(sessionRangee({ expiresInSeconds: -3600 }))
  await page.goto(`${BASE}/c/22222222-2222-2222-2222-222222222222`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4500)
  const texte = await page.innerText('body')
  verifier('la reconnexion est annoncée', /Reconnexion/i.test(texte), `→ ${texte.slice(0, 90)}`)
  verifier('aucun fichier n\'est montré', !/Accès autorisé/i.test(texte))
  await context.close()
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
