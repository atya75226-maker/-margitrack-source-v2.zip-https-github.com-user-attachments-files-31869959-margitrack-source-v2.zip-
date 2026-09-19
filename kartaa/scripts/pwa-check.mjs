/**
 * Vérification de la PWA (Playwright).
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/pwa-check.mjs
 *
 * Ce qui est vérifié, dans cet ordre d'importance :
 *  1. le service worker ne met JAMAIS en cache ce qui vient d'ailleurs — un
 *     jeton d'authentification oublié dans un cache serait une fuite ;
 *  2. le manifeste est complet et l'application réellement installable ;
 *  3. l'invitation d'installation n'apparaît pas dès la première visite.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:4173'

const echecs = []
function verifier(nom, condition, detail = '') {
  if (condition) console.log(`  ok   ${nom}`)
  else {
    console.log(`  ÉCHEC ${nom}${detail ? ` ${detail}` : ''}`)
    echecs.push(nom)
  }
}

const browser = await chromium.launch()

console.log('\nManifeste')
{
  const page = await (await browser.newContext()).newPage()
  const reponse = await page.goto(`${BASE}/manifest.webmanifest`)
  const manifeste = JSON.parse(await reponse.text())
  verifier('servi par le site', reponse.status() === 200)
  verifier('portée « / » — sinon le manifeste est ignoré sur la page d\'accueil',
    manifeste.scope === '/', `→ ${manifeste.scope}`)
  verifier('démarre dans l\'application', manifeste.start_url === '/app', `→ ${manifeste.start_url}`)
  verifier('mode autonome', manifeste.display === 'standalone')
  verifier('icône 192 et 512 présentes',
    ['192x192', '512x512'].every((taille) => manifeste.icons.some((i) => i.sizes === taille)))
  verifier('icône masquable fournie', manifeste.icons.some((i) => i.purpose === 'maskable'))
  for (const icone of manifeste.icons) {
    const r = await page.goto(BASE + icone.src)
    verifier(`icône ${icone.sizes} téléchargeable`, r.status() === 200, `→ ${icone.src}`)
  }
}

console.log('\nService worker')
{
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${BASE}/app`, { waitUntil: 'load' })
  const pret = await page.evaluate(async () => {
    const enregistrement = await navigator.serviceWorker.ready
    return !!enregistrement.active
  }).catch(() => false)
  verifier('enregistré et actif', pret)

  await page.waitForTimeout(1200)
  const caches = await page.evaluate(() => window.caches.keys())
  verifier('un cache est créé', caches.length > 0, `→ ${caches.join(', ')}`)

  // Le cœur du sujet : rien d'un autre domaine ne doit être retenu.
  const externes = await page.evaluate(async () => {
    const noms = await window.caches.keys()
    const urls = []
    for (const nom of noms) {
      const cache = await window.caches.open(nom)
      for (const requete of await cache.keys()) urls.push(requete.url)
    }
    return urls.filter((url) => !url.startsWith(window.location.origin))
  })
  verifier('aucune ressource externe mise en cache', externes.length === 0, `→ ${externes.join(', ')}`)

  const contenus = await page.evaluate(async () => {
    const noms = await window.caches.keys()
    const urls = []
    for (const nom of noms) {
      const cache = await window.caches.open(nom)
      for (const requete of await cache.keys()) urls.push(new URL(requete.url).pathname)
    }
    return urls
  })
  verifier('aucun appel d\'API mis en cache',
    !contenus.some((chemin) => /\/rest\/v1|\/auth\/v1|\/storage\/v1|\/functions\/v1/.test(chemin)),
    `→ ${contenus.join(', ')}`)
  await context.close()
}

console.log('\nInstallation dès le premier chargement')
{
  // Chromium sans drapeau n'émet pas beforeinstallprompt : on l'émet nous-mêmes
  // au premier chargement, exactement comme le fait Chrome sur un téléphone,
  // pour vérifier que l'application le capte sans rien recharger.
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.addInitScript(() => {
    window.__prompt = 0
    const evenement = new Event('beforeinstallprompt')
    evenement.prompt = () => { window.__prompt += 1 }
    evenement.userChoice = Promise.resolve({ outcome: 'accepted' })
    // Émis très tôt, avant que React ne soit monté : c'est le cas réel.
    document.addEventListener('DOMContentLoaded', () => window.dispatchEvent(evenement))
  })

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const texte = await page.innerText('body')

  verifier("le bouton d'installation est là au premier chargement, sans compte",
    /Installer Kartaa/.test(texte), `→ ${texte.slice(0, 120)}`)
  verifier("aucune consigne de rechargement",
    !/recharg|actualis|revenez|deuxième visite/i.test(texte))

  await page.click('button:has-text("Installer Kartaa")')
  await page.waitForTimeout(600)
  const appels = await page.evaluate(() => window.__prompt)
  verifier("le clic déclenche la vraie fenêtre du navigateur", appels === 1, `→ ${appels} appel(s)`)
  await context.close()
}

console.log('\nService worker enregistré même quand « load » est déjà passé')
{
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${BASE}/app`, { waitUntil: 'load' })
  // On recharge une fois : le deuxième chargement est celui où « load » risque
  // d'avoir précédé l'exécution du module.
  await page.reload({ waitUntil: 'load' })
  await page.waitForTimeout(1500)
  const actif = await page.evaluate(async () => {
    const enregistrement = await navigator.serviceWorker.getRegistration()
    return !!(enregistrement && (enregistrement.active || enregistrement.installing))
  })
  verifier('enregistré sur un chargement rapide', actif)
  await context.close()
}

console.log('\nChaque navigateur reçoit SA marche à suivre')
{
  // Le même lien, cinq navigateurs : aucun ne doit rester sans chemin, et
  // aucun ne doit recevoir le chemin de menu d'un autre.
  const navigateurs = [
    ['Chrome Android', 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36', /menu ⋮/],
    ['Samsung Internet', 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36', /menu ≡/],
    ['Firefox Android', 'Mozilla/5.0 (Android 13; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0', /menu ⋮/],
    ['Opera Android', 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 OPR/79.0', /menu Opera/],
    ['Safari iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', /Partager/],
    // Fenêtre intégrée à Facebook : elle n'installe jamais, la seule issue est
    // d'en sortir. C'est la cause la plus fréquente d'un téléphone qui n'y
    // arrive pas alors qu'un autre y arrive.
    ['Fenêtre Facebook', 'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 [FBAN/EMA;FBLC/fr_FR]', /Ouvrir dans Chrome/],
  ]

  for (const [nom, agent, attendu] of navigateurs) {
    const context = await browser.newContext({ userAgent: agent })
    const page = await context.newPage()
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1800)

    // Le bouton doit exister partout, et ouvrir la marche à suivre.
    const bouton = page.locator('button:has-text("Installer Kartaa")').first()
    verifier(`${nom} : le bouton d'installation existe`, await bouton.count() > 0)
    await bouton.click()
    await page.waitForTimeout(600)
    const texte = await page.innerText('body')
    verifier(`${nom} : reçoit sa propre marche à suivre`, attendu.test(texte),
      `→ ${texte.slice(texte.indexOf('Installer Kartaa'), texte.indexOf('Installer Kartaa') + 200)}`)
    verifier(`${nom} : aucune consigne de rechargement`, !/recharg|actualis|pas encore proposée/i.test(texte))
    await context.close()
  }
}

console.log('\nApplication déjà installée')
{
  const context = await browser.newContext()
  const page = await context.newPage()
  // On simule le mode autonome, comme au lancement depuis l'icône.
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window)
    window.matchMedia = (requete) => (requete.includes('standalone')
      ? { matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
      : original(requete))
  })
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  verifier("« / » mène à la connexion, jamais au marketing",
    new URL(page.url()).pathname === '/connexion', `→ ${page.url()}`)
  const texte = await page.innerText('body')
  verifier("aucune proposition d'installation une fois installée",
    !/Installer Kartaa/.test(texte))
  await context.close()
}

console.log('\nSession conservée après installation')
{
  // L'application installée tourne sur la même adresse : elle partage donc le
  // stockage du navigateur. Installer ne doit jamais déconnecter.
  const KEY = 'sb-wadapjshbdjkjrfnsnyr-auth-token'
  const session = {
    access_token: 'a.b.c', refresh_token: 'r',
    expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
    user: {
      id: '11111111-1111-1111-1111-111111111111', email: 'awa@example.com',
      user_metadata: { first_name: 'Awa', last_name: 'Diallo' },
      app_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
    },
  }
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [{ origin: BASE, localStorage: [{ name: KEY, value: JSON.stringify(session) }] }] },
  })
  await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))
  const page = await context.newPage()
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window)
    window.matchMedia = (requete) => (requete.includes('standalone')
      ? { matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
      : original(requete))
  })
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  verifier("la session ouverte mène au tableau de bord",
    new URL(page.url()).pathname === '/app', `→ ${page.url()}`)
  verifier('le tableau de bord est bien affiché', /tableau de bord/i.test(await page.innerText('body')))
  await context.close()
}

await browser.close()
console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nTout est conforme.')
process.exit(echecs.length ? 1 : 0)
