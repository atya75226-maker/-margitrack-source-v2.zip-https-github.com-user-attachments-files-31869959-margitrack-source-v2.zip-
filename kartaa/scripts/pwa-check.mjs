/**
 * Vérification de la PWA (Playwright).
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/pwa-check.mjs
 *
 * Ce qui est vérifié, dans cet ordre d'importance :
 *  1. le service worker ne met JAMAIS en cache ce qui vient d'ailleurs — un
 *     fichier de coffre ou une URL signée oubliés dans un cache annuleraient la
 *     protection du coffre ;
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

console.log('\nInvitation d\'installation')
{
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  verifier('absente à la première visite',
    !(await page.innerText('body')).includes('Installer Kartaa'))
  const visites = await page.evaluate(() => window.localStorage.getItem('kartaa.pwa.visites'))
  verifier('les visites sont comptées', Number(visites) >= 1, `→ ${visites}`)
  await context.close()
}

await browser.close()
console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nTout est conforme.')
process.exit(echecs.length ? 1 : 0)
