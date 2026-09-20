/**
 * Test de bout en bout du prototype (Playwright).
 *
 * PÉRIMÉ — NE PASSE PLUS. Écrit avant le passage à Supabase : il lit encore la
 * base locale du prototype (kartaa.db.v1), attend des identifiants crd_/vlt_ et
 * déroule le Coffre Sécurité, retiré de l'application depuis. Conservé pour
 * mémoire, à réécrire. Les contrôles qui font foi sont les autres scripts de ce
 * dossier (offline, pwa, session, plan, export, photo, scanner, maj).
 *
 *   npm run build && npm run preview -- --port 4178
 *   npm install --no-save playwright && npx playwright install chromium
 *   node scripts/e2e-smoke.mjs            # ou BASE_URL=... node scripts/e2e-smoke.mjs
 *
 * Il parcourt le chemin complet : compte → carte → QR → mini-site → coffre →
 * fichier chiffré → verrouillage → mauvais mot de passe → récupération.
 * Les captures d'écran sont écrites dans .e2e-output/.
 *
 * Prérequis : un accès réseau au projet Supabase, et l'option « Confirm email »
 * désactivée dans Authentication → Sign In / Providers (sinon l'inscription
 * s'arrête sur l'écran de confirmation — le test le signale).
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:4178'
const out = '.e2e-output'
mkdirSync(out, { recursive: true })
const errors = []

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true })
const page = await context.newPage()
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message))

const step = async (name, fn) => {
  process.stdout.write(`• ${name} … `)
  try { await fn(); console.log('ok') } catch (e) { console.log('FAIL\n  ' + e.message); throw e }
}

await step('landing', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Votre identité.')
  await page.screenshot({ path: `${out}/01-landing.png`, fullPage: false })
})

await step('signup', async () => {
  await page.goto(`${BASE}/inscription`, { waitUntil: 'networkidle' })
  await page.fill('input[autocomplete="given-name"]', 'Awa')
  await page.fill('input[autocomplete="family-name"]', 'Traoré')
  await page.fill('input[type="email"]', 'awa@example.com')
  await page.fill('input[type="tel"]', '+225 07 00 12 34 56')
  const pwds = page.locator('input[autocomplete="new-password"]')
  await pwds.nth(0).fill('MotDePasse2024!')
  await pwds.nth(1).fill('MotDePasse2024!')
  await page.click('button[type="submit"]')
  await Promise.race([
    page.waitForURL('**/app/cartes/nouvelle', { timeout: 30000 }),
    page.waitForSelector('text=Confirmez votre adresse e-mail', { timeout: 30000 }).then(() => {
      throw new Error(
        "Le projet Supabase exige une confirmation par e-mail : désactivez « Confirm email » "
        + 'dans Authentication → Sign In / Providers pour pouvoir lancer ce test.',
      )
    }),
  ])
})

await step('wizard step 1', async () => {
  await page.fill('input[placeholder="Consultante en marketing digital"]', 'Consultante en marketing digital')
  await page.fill('input[placeholder="Abidjan"]', 'Abidjan')
  await page.fill("input[placeholder=\"Côte d'Ivoire\"]", "Côte d'Ivoire")
  await page.click('button:has-text("Continuer")')
})

await step('wizard socials', async () => {
  await page.click('button[role="switch"] >> nth=1')  // Facebook
  await page.fill('input[placeholder="https://facebook.com/…"]', 'facebook.com/awa')
  await page.click('button:has-text("Continuer")')
})

await step('wizard about', async () => {
  await page.fill('textarea', "Entrepreneure spécialisée dans le digital et l'accompagnement des petites entreprises.")
  await page.click('button:has-text("+ Marketing digital")')
  await page.click('button:has-text("Continuer")')
})

await step('wizard companies', async () => {
  await page.click('button:has-text("Continuer")')
})

await step('wizard design + save', async () => {
  await page.waitForSelector('text=Modèle de carte')
  await page.screenshot({ path: `${out}/02-design.png`, fullPage: true })
  await page.click('button:has-text("Créer ma carte")')
  await page.waitForURL(/\/app\/cartes\/crd_/, { timeout: 15000 })
  await page.waitForSelector('text=Mon QR Code')
  await page.screenshot({ path: `${out}/03-card-detail.png`, fullPage: true })
})

for (const format of ['PNG', 'PDF']) {
  await step(`download card as ${format}`, async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      page.click(`button:has-text("${format}")`),
    ])
    const path = await download.path()
    const { size } = await (await import('node:fs/promises')).stat(path)
    if (size < 5000) throw new Error(`fichier ${format} trop petit : ${size} o`)
    console.log(`   (${download.suggestedFilename()}, ${Math.round(size / 1024)} Ko)`)
  })
}

let slug = null
await step('public mini-site + scan count', async () => {
  slug = await page.evaluate(() => JSON.parse(localStorage.getItem('kartaa.db.v1')).cards[0].slug)
  await page.goto(`${BASE}/${slug}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Ajouter aux contacts')
  await page.screenshot({ path: `${out}/04-public.png`, fullPage: true })
  const scans = await page.evaluate(() => JSON.parse(localStorage.getItem('kartaa.db.v1')).cards[0].scans)
  if (scans !== 1) throw new Error(`scans attendu 1, obtenu ${scans}`)
})

await step('create vault', async () => {
  await page.goto(`${BASE}/app/coffres/nouveau`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="Mes souvenirs"]', 'Mes souvenirs')
  await page.click('button:has-text("Continuer")')
  const pwds = page.locator('input[autocomplete="new-password"]')
  await pwds.nth(0).fill('CoffreSecret2024!')
  await pwds.nth(1).fill('CoffreSecret2024!')
  await page.click('button:has-text("Protéger mon coffre")')
  await page.waitForSelector('text=Code de récupération', { timeout: 20000 })
})

let recovery = null
await step('recovery code', async () => {
  recovery = (await page.locator('p.font-mono').first().innerText()).trim()
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(recovery)) throw new Error('code invalide: ' + recovery)
  await page.screenshot({ path: `${out}/05-recovery.png`, fullPage: true })
  await page.check('input[type="checkbox"]')
  await page.click('button:has-text("Ouvrir mon coffre")')
  await page.waitForURL(/\/app\/coffres\/vlt_/, { timeout: 15000 })
})

await step('upload encrypted file', async () => {
  await page.waitForSelector('text=Contenu du coffre', { timeout: 15000 })
  await page.setInputFiles('input[type="file"]', {
    name: 'diplome.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Diplôme confidentiel — contenu secret 12345'),
  })
  await page.waitForSelector('text=diplome.txt', { timeout: 15000 })
  await page.screenshot({ path: `${out}/06-vault.png`, fullPage: true })
})

let vaultId = null
await step('vault QR + lock', async () => {
  vaultId = page.url().split('/').pop()
  await page.click('button:has-text("QR Code")')
  await page.waitForSelector('img[alt="QR Code du coffre"]', { timeout: 15000 })
  await page.click('button:has-text("Verrouiller")')
  await page.waitForSelector('text=Ce coffre est protégé.')
})

await step('scan vault QR → unlock screen hides files', async () => {
  await page.goto(`${BASE}/c/${vaultId}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Ce coffre est protégé.')
  const body = await page.locator('body').innerText()
  if (body.includes('diplome.txt')) throw new Error('un fichier est visible avant authentification !')
  await page.screenshot({ path: `${out}/07-vault-lock.png`, fullPage: true })
})

await step('wrong password is rejected', async () => {
  await page.fill('input[type="password"]', 'mauvaispass')
  await page.click('button:has-text("Déverrouiller")')
  await page.waitForSelector('text=Mot de passe incorrect', { timeout: 20000 })
})

await step('right password unlocks and decrypts', async () => {
  await page.fill('input[type="password"]', 'CoffreSecret2024!')
  await page.click('button:has-text("Déverrouiller")')
  await page.waitForSelector('text=Accès autorisé', { timeout: 20000 })
  await page.waitForSelector('text=diplome.txt')
})

await step('password recovery with code', async () => {
  await page.goto(`${BASE}/c/${vaultId}`, { waitUntil: 'networkidle' })
  await page.click('button:has-text("Mot de passe oublié")')
  await page.fill('input[placeholder="8K7P-42LM-X91Q"]', recovery)
  const pwds = page.locator('input[autocomplete="new-password"]')
  await pwds.nth(0).fill('NouveauSecret2024!')
  await pwds.nth(1).fill('NouveauSecret2024!')
  await page.click('button:has-text("Réinitialiser")')
  await page.waitForSelector('text=Votre coffre est maintenant protégé', { timeout: 30000 })
  const newCode = (await page.locator('p.font-mono').first().innerText()).trim()
  if (newCode === recovery) throw new Error("le code de récupération n'a pas été renouvelé")
  await page.check('input[type="checkbox"]')
  await page.click('button:has-text("Ouvrir mon coffre")')
  await page.waitForSelector('text=diplome.txt', { timeout: 20000 })
})

await step('dashboard + stats', async () => {
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Votre tableau de bord')
  await page.screenshot({ path: `${out}/08-dashboard.png`, fullPage: true })
  await page.goto(`${BASE}/app/statistiques`, { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Scans par jour')
  await page.screenshot({ path: `${out}/09-stats.png`, fullPage: true })
})

await step('desktop landing screenshot', async () => {
  const wide = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await wide.goto(BASE, { waitUntil: 'networkidle' })
  await wide.waitForTimeout(800)
  await wide.screenshot({ path: `${out}/10-landing-desktop.png` })
  await wide.close()
})

await browser.close()
const relevant = errors.filter((text) => !/fonts\.(googleapis|gstatic)|ERR_CONNECTION_RESET|remote stylesheet|cssRules/.test(text))
console.log('\nParcours complet vérifié. Erreurs console :', relevant.length ? relevant : 'aucune')
