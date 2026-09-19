/**
 * L'application installée doit se mettre à jour toute seule (Playwright).
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/maj-check.mjs
 *
 * Le navigateur ne cherche une nouvelle version du service worker qu'au moment
 * d'une navigation. Une application installée qu'on rouvre depuis
 * l'arrière-plan ne navigue pas : sans vérification au retour, elle reste sur
 * la version qu'elle avait au dernier chargement — c'est ainsi qu'un écran
 * supprimé continuait de s'afficher des jours après sa suppression.
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
const context = await browser.newContext({ viewport: { width: 412, height: 900 } })
const page = await context.newPage()

// On compte les appels à registration.update() et on retient les messages
// envoyés au service worker, sans rien changer d'autre.
await page.addInitScript(() => {
  window.__majDemandees = 0
  window.__messages = []
  const update = ServiceWorkerRegistration.prototype.update
  ServiceWorkerRegistration.prototype.update = function compte(...args) {
    window.__majDemandees += 1
    return update.apply(this, args)
  }
  const post = ServiceWorker.prototype.postMessage
  ServiceWorker.prototype.postMessage = function retient(message, ...args) {
    window.__messages.push(message)
    return post.apply(this, [message, ...args])
  }
})

console.log('\nVérification de version')
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 20000 }).catch(() => null)
await page.waitForTimeout(1500)

const auChargement = await page.evaluate(() => window.__majDemandees)
verifier('une vérification a lieu au chargement', auChargement >= 1, `→ ${auChargement}`)

console.log('\nRetour sur l’application après un passage en arrière-plan')
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
  document.dispatchEvent(new Event('visibilitychange'))
})
await page.waitForTimeout(400)
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  document.dispatchEvent(new Event('visibilitychange'))
})
await page.waitForTimeout(1200)

const auRetour = await page.evaluate(() => window.__majDemandees)
verifier('une nouvelle vérification a lieu au retour', auRetour > auChargement, `→ ${auRetour} au total`)

console.log('\nBascule vers la version en attente')
const envoi = await page.evaluate(async () => {
  const enregistrement = await navigator.serviceWorker.getRegistration()
  if (!enregistrement?.active) return 'aucun worker actif'
  enregistrement.active.postMessage('appliquer-la-mise-a-jour')
  return 'envoyé'
})
verifier('le message de bascule part vers le service worker', envoi === 'envoyé', `→ ${envoi}`)
const messages = await page.evaluate(() => window.__messages)
verifier('c’est bien « appliquer-la-mise-a-jour »', messages.includes('appliquer-la-mise-a-jour'),
  `→ ${JSON.stringify(messages)}`)

// Le service worker doit écouter ce message, sinon il ne bascule jamais.
const source = await (await fetch(`${BASE}/sw.js`)).text()
verifier('le service worker écoute ce message', source.includes("'appliquer-la-mise-a-jour'"))
verifier('il efface les anciens caches à l’activation', /caches\s*\n?\s*\.keys\(\)/.test(source) && source.includes('caches.delete'))

await browser.close()
console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nTout est conforme.')
process.exit(echecs.length ? 1 : 0)
