/**
 * Limite de stockage du Coffre Sécurité (Playwright).
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/stockage-check.mjs
 *
 * Vérifie que la limite est une vraie limite : l'espace affiché est la somme
 * des tailles réelles, un fichier qui ne tient pas n'est même pas téléversé,
 * une série de petits fichiers ne passe pas par accumulation, et supprimer un
 * fichier rend sa place.
 *
 * Le faux serveur applique la même règle que la base : il refuse tout
 * enregistrement qui ferait dépasser le quota. On compte donc aussi ce que le
 * navigateur a tenté — un blocage qui n'existerait que dans l'écran laisserait
 * passer l'appel.
 */
import { chromium } from 'playwright'
import { webcrypto as crypto } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const KEY = 'sb-wadapjshbdjkjrfnsnyr-auth-token'
const COMPTE = '11111111-1111-1111-1111-111111111111'
const COFFRE = '88888888-8888-8888-8888-888888888888'
const MO = 1024 * 1024
const QUOTA_FREE = 20 * MO

const echecs = []
function verifier(nom, condition, detail = '') {
  if (condition) console.log(`  ok   ${nom}`)
  else {
    console.log(`  ÉCHEC ${nom}${detail ? ` ${detail}` : ''}`)
    echecs.push(nom)
  }
}

/** La fenêtre Pro couvre l'écran : on la referme avant de continuer. */
async function fermerLaFenetrePro(page) {
  for (let essai = 0; essai < 3; essai += 1) {
    if (!(await page.locator('text=Stockage du Coffre Sécurité').count())) return
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  }
}

const dossier = mkdtempSync(join(tmpdir(), 'kartaa-stockage-'))
function fichierDe(mo, nom) {
  const chemin = join(dossier, nom)
  writeFileSync(chemin, Buffer.alloc(mo * MO, 7))
  return chemin
}

/* ------------------------------------------- mêmes primitives que l'application */

const b64 = (buffer) => Buffer.from(new Uint8Array(buffer)).toString('base64')
const debase64 = (valeur) => new Uint8Array(Buffer.from(valeur, 'base64'))
const MOT_DE_PASSE = 'Coffre-Test-2026'

async function derive(phrase, selB64, tours = 210_000) {
  const matiere = await crypto.subtle.importKey('raw', new TextEncoder().encode(phrase), 'PBKDF2', false, ['deriveBits'])
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: debase64(selB64), iterations: tours, hash: 'SHA-256' }, matiere, 512,
  ))
  const cle = await crypto.subtle.importKey('raw', bits.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  return { cle, verifier: b64(bits.slice(32, 64)) }
}

async function envelopper(cleBrute, phrase) {
  const sel = b64(crypto.getRandomValues(new Uint8Array(16)))
  const { cle, verifier } = await derive(phrase, sel)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, cleBrute)
  return { wrap: { iv: b64(iv), data: b64(data), salt: sel, iterations: 210_000 }, verifier, salt: sel }
}

const cleDuCoffre = crypto.getRandomValues(new Uint8Array(32))
const motDePasse = await envelopper(cleDuCoffre, MOT_DE_PASSE)
const recuperation = await envelopper(cleDuCoffre, 'AAAA-BBBB-CCCC')

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

async function scenario({ pro }) {
  console.log(`\nCompte ${pro ? 'Pro' : 'gratuit'}`)
  const quota = pro ? 20480 * MO : QUOTA_FREE
  let fichiers = []
  let tentatives = 0
  let refusParLeServeur = 0

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 420, height: 950 },
    storageState: { cookies: [], origins: [{ origin: BASE, localStorage: [{ name: KEY, value: JSON.stringify(session) }] }] },
  })

  await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))
  await context.route('**/rest/v1/profiles*', (route) => json(route, {
    id: COMPTE, first_name: 'Awa', last_name: 'Diallo', email: 'awa@example.com',
    phone: '', avatar_url: '', plan: pro ? 'pro' : 'free',
    pro_until: pro ? new Date(Date.now() + 30 * 86400000).toISOString() : null,
  }))
  await context.route('**/rest/v1/cards*', (route) => json(route, []))
  await context.route('**/rest/v1/vault_access_log*', (route) => json(route, []))
  await context.route('**/storage/v1/object/vault-files/**', (route) => json(route, { Key: 'ok' }))

  await context.route('**/rest/v1/vault_files*', (route) => {
    const methode = route.request().method()
    if (methode === 'POST') {
      tentatives += 1
      const corps = JSON.parse(route.request().postData() || '{}')
      const ligne = Array.isArray(corps) ? corps[0] : corps
      const total = fichiers.reduce((somme, f) => somme + f.size, 0)
      // Même règle que le déclencheur de la base.
      if (total + ligne.size > quota) {
        refusParLeServeur += 1
        return route.fulfill({
          status: 400, contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ message: 'Espace de stockage insuffisant pour votre offre.' }),
        })
      }
      fichiers.push({
        id: crypto.randomUUID(), vault_id: COFFRE, name: ligne.name, mime: ligne.mime,
        category: ligne.category, size: ligne.size, folder_id: null,
        storage_path: ligne.storage_path, iv: ligne.iv, added_at: new Date().toISOString(),
      })
      return json(route, [])
    }
    if (methode === 'DELETE') {
      const url = route.request().url()
      const id = decodeURIComponent(url.split('id=eq.')[1] || '').split('&')[0]
      fichiers = fichiers.filter((f) => f.id !== id)
      return json(route, [])
    }
    return json(route, fichiers)
  })

  await context.route('**/rest/v1/vaults*', (route) => {
    const ligne = {
      id: COFFRE, user_id: COMPTE, name: 'Documents importants', protection: 'password',
      folders: [], failed_attempts: 0, locked_until: null, last_opened_at: null,
      recovery_issued_at: null, recovery_used_at: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    const url = route.request().url()
    if (url.includes('user_id=eq.')) return json(route, [ligne])
    if (url.includes('id=eq.')) return json(route, ligne)
    return json(route, [])
  })
  await context.route('**/rest/v1/rpc/**', (route) => {
    const nom = new URL(route.request().url()).pathname.split('/').pop()
    const corps = JSON.parse(route.request().postData() || '{}')
    if (nom === 'vault_intro') {
      return json(route, {
        id: COFFRE, isOwner: true, name: 'Documents importants', protection: 'password',
        hasBiometric: false, biometric: null, biometricSalt: null, biometricIterations: null,
        failedAttempts: 0, lockedUntil: null, kdfIterations: 210_000,
        passwordSalt: motDePasse.salt, recoverySalt: recuperation.salt,
      })
    }
    if (nom === 'vault_open') {
      if (corps.p_verifier !== motDePasse.verifier) return json(route, { ok: false, error: 'password', attemptsLeft: 4 })
      return json(route, { ok: true, wrap: motDePasse.wrap, token: 'j'.repeat(64) })
    }
    return json(route, null)
  })

  const page = await context.newPage()

  // Déverrouillage réel, par le mot de passe : la clé du coffre ne vit qu'en
  // mémoire, elle ne peut pas être posée de l'extérieur.
  await page.goto(`${BASE}/app/coffres/${COFFRE}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Mot de passe', { timeout: 20000 })
  await page.fill('input[type=password]', MOT_DE_PASSE)
  await page.click('button:has-text("Déverrouiller")')

  const ouvert = await page.waitForSelector('text=Coffre déverrouillé', { timeout: 40000 }).then(() => true).catch(() => false)
  if (!ouvert) {
    verifier('le coffre est déverrouillé pour le test', false, `→ ${page.url()}`)
    await browser.close()
    return
  }

  const texteStockage = async () => (await page.locator('text=/utilisés/').first().textContent()) || ''
  verifier('le quota affiché correspond à l’offre',
    (await texteStockage()).includes(pro ? '20 Go' : '20 Mo'),
    `→ ${(await texteStockage()).trim()}`)

  const entree = page.locator('input[type=file]').first()

  // 1. un fichier qui tient
  await entree.setInputFiles(fichierDe(8, 'huit.bin'))
  await page.waitForSelector('text=Fichier ajouté et chiffré', { timeout: 60000 }).catch(() => null)
  await page.waitForTimeout(800)
  verifier('un fichier qui tient est ajouté', fichiers.length === 1, `→ ${fichiers.length} fichier(s)`)
  verifier("l'espace utilisé suit la taille réelle",
    /^8([.,]0)?\s*Mo\s*\//.test((await texteStockage()).trim()), `→ ${(await texteStockage()).trim()}`)

  if (!pro) {
    // 2. un fichier qui ne tient pas : refusé AVANT le moindre envoi
    const avant = tentatives
    await entree.setInputFiles(fichierDe(15, 'quinze.bin'))
    await page.waitForTimeout(2500)
    verifier('un fichier trop gros est refusé', fichiers.length === 1, `→ ${fichiers.length} fichier(s)`)
    verifier("il n'est même pas envoyé au serveur", tentatives === avant,
      `→ ${tentatives - avant} tentative(s)`)
    // La fenêtre Pro s'ouvre : un seul chemin d'achat, vers « Mon abonnement ».
    verifier('le passage à Pro est proposé',
      (await page.locator('text=Stockage du Coffre Sécurité').count()) > 0)
    verifier("l'espace gratuit est nommé dans le message",
      (await page.locator('text=20 Mo').count()) > 0)

    // 3. plusieurs fichiers d'un coup : le cumul compte
    await fermerLaFenetrePro(page)
    const avant2 = tentatives
    await entree.setInputFiles([fichierDe(6, 'six-a.bin'), fichierDe(6, 'six-b.bin'), fichierDe(6, 'six-c.bin')])
    await page.waitForTimeout(6000)
    const total = fichiers.reduce((somme, f) => somme + f.size, 0)
    verifier('une série de fichiers ne dépasse jamais la limite', total <= QUOTA_FREE,
      `→ ${(total / MO).toFixed(1)} Mo`)
    verifier('seuls les fichiers qui tiennent sont envoyés', tentatives - avant2 === 2,
      `→ ${tentatives - avant2} tentative(s)`)
    verifier('le serveur n’a jamais eu à refuser', refusParLeServeur === 0,
      `→ ${refusParLeServeur} refus`)
  }

  // 4. supprimer libère la place
  await fermerLaFenetrePro(page)
  const avantSuppression = fichiers.reduce((somme, f) => somme + f.size, 0)
  await page.locator('button[aria-label="Supprimer"], button:has-text("Supprimer")').first().click()
  await page.waitForTimeout(400)
  await page.locator('button:has-text("Supprimer")').last().click()
  await page.waitForTimeout(1500)
  const apres = fichiers.reduce((somme, f) => somme + f.size, 0)
  verifier('supprimer un fichier libère son espace', apres < avantSuppression,
    `→ ${(avantSuppression / MO).toFixed(1)} Mo puis ${(apres / MO).toFixed(1)} Mo`)

  await browser.close()
}

await scenario({ pro: false })
await scenario({ pro: true })

console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nTout est conforme.')
process.exit(echecs.length ? 1 : 0)
