/**
 * Séparation Gratuit / Pro dans l'interface (Playwright).
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/plan-check.mjs
 *
 * Le serveur d'authentification est coupé : on injecte une session et un profil
 * de chaque offre pour comparer les deux écrans. Ce test regarde ce que voit la
 * personne ; la protection réelle, elle, est vérifiée en base (voir la migration
 * 20260916100000_separation_free_pro.sql et le README).
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const KEY = 'sb-wadapjshbdjkjrfnsnyr-auth-token'

const echecs = []
function verifier(nom, condition, detail = '') {
  if (condition) console.log(`  ok   ${nom}`)
  else {
    console.log(`  ÉCHEC ${nom}${detail ? ` ${detail}` : ''}`)
    echecs.push(nom)
  }
}

function session() {
  return {
    access_token: 'a.b.c',
    refresh_token: 'r',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
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

const browser = await chromium.launch()

/**
 * Ouvre l'application avec un profil de l'offre voulue.
 *
 * Le profil arrive normalement de la table profiles ; ici le réseau est coupé,
 * donc on répond à sa place sur la route PostgREST correspondante.
 */
async function ouvrir(plan) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    storageState: {
      cookies: [],
      origins: [{ origin: BASE, localStorage: [{ name: KEY, value: JSON.stringify(session()) }] }],
    },
  })

  // L'ordre compte : Playwright donne la main à la route enregistrée en
  // dernier. Le blocage général vient donc d'abord, la réponse au profil ensuite.
  await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))

  await context.route('**/rest/v1/profiles*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        id: '11111111-1111-1111-1111-111111111111',
        first_name: 'Awa', last_name: 'Diallo', email: 'awa@example.com',
        phone: '', avatar_url: '', plan,
      }),
    }))

  const page = await context.newPage()
  return { page, context }
}

for (const plan of ['free', 'pro']) {
  console.log(`\nCompte ${plan === 'pro' ? 'Pro' : 'Gratuit'}`)
  const { page, context } = await ouvrir(plan)

  await page.goto(`${BASE}/app/abonnement`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const abonnement = await page.innerText('body')

  // Un seul bouton d'abonnement, quelle que soit l'offre.
  const boutons = await page.locator('button, a').evaluateAll((n) =>
    n.map((e) => e.textContent.trim()).filter((texte) => /Passer à Pro|Upgrade to Pro/i.test(texte)))
  verifier('un seul bouton « Passer à Pro »', boutons.length <= 1, `→ ${boutons.length}`)

  verifier('le prix affiché est 5 000 FCFA', /5\s?000\s?FCFA|5,000\s?FCFA/.test(abonnement))
  verifier('aucune autre offre payante nommée',
    !/Premium\s*[:—-]?\s*\d|VIP\s*[:—-]?\s*\d|\d+\s?FCFA(?!\s*\/?\s*mois|\s*\/?\s*month)/i.test(
      abonnement.replace(/5\s?000\s?FCFA/g, '').replace(/5,000\s?FCFA/g, '')))
  verifier("aucune activation sans paiement",
    !/démonstration|demonstration/i.test(abonnement), `→ ${abonnement.slice(0, 80)}`)

  if (plan === 'free') {
    verifier('l’offre Gratuit est annoncée', /offre Gratuit|Free plan/i.test(abonnement))
    verifier('le bouton « Passer à Pro » est présent', boutons.length === 1)
  } else {
    verifier('l’abonnement Pro est reconnu', /abonné à Pro|subscribed to Pro/i.test(abonnement))
    verifier('aucun bouton d’achat pour un abonné', boutons.length === 0)
  }

  // Statistiques : verrouillées pour le gratuit, ouvertes pour le Pro.
  await page.goto(`${BASE}/app/statistiques`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  const stats = await page.innerText('body')
  if (plan === 'free') {
    verifier('statistiques avancées verrouillées', /Statistiques avancées/.test(stats))
    verifier('la valeur de la fonctionnalité est expliquée', /qui appelle, qui écrit/.test(stats))
    verifier('un chemin « Voir Pro » est proposé', /Voir Pro/.test(stats))
  } else {
    verifier('aucun verrou affiché à un abonné', !/Voir Pro/.test(stats))
  }

  await context.close()
}

await browser.close()
console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nTout est conforme.')
process.exit(echecs.length ? 1 : 0)
