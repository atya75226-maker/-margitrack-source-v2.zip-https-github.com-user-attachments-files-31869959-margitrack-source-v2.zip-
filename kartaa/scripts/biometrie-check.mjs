/**
 * Déverrouillage biométrique du coffre (Playwright + capteur virtuel).
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/biometrie-check.mjs
 *
 * Chromium sait simuler un capteur d'empreinte (WebAuthn virtual authenticator).
 * Le test rejoue donc le parcours complet, sans rien simuler du code de Kartaa :
 * le propriétaire ouvre son coffre avec son mot de passe et active l'empreinte,
 * puis la page atteinte par le QR Code — sans compte — ouvre le coffre au doigt.
 *
 * Ce qui était cassé : la page publique ne proposait jamais l'empreinte, et la
 * fonction d'ouverture exigeait un compte propriétaire sans délivrer le jeton
 * qui donne accès aux fichiers.
 *
 * Le faux serveur ci-dessous reproduit les règles réelles de la base : il ne
 * livre l'enveloppe chiffrée que contre le vérificateur attendu.
 */
import { chromium } from 'playwright'
import { webcrypto as crypto } from 'node:crypto'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const KEY = 'sb-wadapjshbdjkjrfnsnyr-auth-token'
const COFFRE = '55555555-5555-5555-5555-555555555555'
const COMPTE = '11111111-1111-1111-1111-111111111111'
const MOT_DE_PASSE = 'Coffre-Test-2026'

const echecs = []
function verifier(nom, condition, detail = '') {
  if (condition) console.log(`  ok   ${nom}`)
  else {
    console.log(`  ÉCHEC ${nom}${detail ? ` ${detail}` : ''}`)
    echecs.push(nom)
  }
}

/* ------------------------------------------------ mêmes primitives que l'app */

const b64 = (buffer) => Buffer.from(new Uint8Array(buffer)).toString('base64')
const debase64 = (value) => new Uint8Array(Buffer.from(value, 'base64'))

async function derive(passphrase, saltB64, iterations = 210_000) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveBits'])
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: debase64(saltB64), iterations, hash: 'SHA-256' }, material, 512,
  ))
  const wrappingKey = await crypto.subtle.importKey('raw', bits.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  return { wrappingKey, verifier: b64(bits.slice(32, 64)) }
}

async function envelopper(cleBrute, passphrase) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)))
  const { wrappingKey, verifier } = await derive(passphrase, salt)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, cleBrute)
  return { wrap: { iv: b64(iv), data: b64(data), salt, iterations: 210_000 }, verifier, salt }
}

/* -------------------------------------------------------------- faux serveur */

const cleDuCoffre = crypto.getRandomValues(new Uint8Array(32))
const motDePasse = await envelopper(cleDuCoffre, MOT_DE_PASSE)
const recuperation = await envelopper(cleDuCoffre, 'AAAA-BBBB-CCCC')

const etat = {
  nom: 'Documents importants',
  biometric: null,
  biometricWrap: null,
  biometricVerifier: null,
  jetons: new Set(),
  ouverturesBiometriques: 0,
  refusBiometriques: 0,
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

function ligneCoffre() {
  return {
    id: COFFRE, user_id: COMPTE, name: etat.nom,
    protection: etat.biometric ? 'password+biometric' : 'password',
    folders: [], failed_attempts: 0, locked_until: null, last_opened_at: null,
    recovery_issued_at: null, recovery_used_at: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }
}

function nouveauJeton() {
  const jeton = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[^a-z0-9]/gi, '').padEnd(64, 'a')
  etat.jetons.add(jeton)
  return jeton
}

/** Règles de vault_intro : les sels sont publics, le nom ne l'est pas. */
function intro(proprietaire) {
  return {
    id: COFFRE,
    isOwner: proprietaire,
    name: proprietaire ? etat.nom : null,
    protection: etat.biometric ? 'password+biometric' : 'password',
    hasBiometric: !!etat.biometric,
    biometric: etat.biometric
      ? { credentialId: etat.biometric.credentialId, prfSalt: etat.biometric.prfSalt, prfSupported: etat.biometric.prfSupported }
      : null,
    biometricSalt: etat.biometricWrap?.salt || null,
    biometricIterations: etat.biometricWrap?.iterations || null,
    failedAttempts: 0, lockedUntil: null, kdfIterations: 210_000,
    passwordSalt: motDePasse.salt, recoverySalt: recuperation.salt,
  }
}

async function installerRoutes(context, { proprietaire }) {
  await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))
  await context.route('**/rest/v1/profiles*', (route) => json(route, {
    id: COMPTE, first_name: 'Awa', last_name: 'Diallo', email: 'awa@example.com',
    phone: '', avatar_url: '', plan: 'pro',
  }))
  await context.route('**/rest/v1/cards*', (route) => json(route, []))
  await context.route('**/rest/v1/vault_files*', (route) => json(route, []))
  await context.route('**/rest/v1/vault_access_log*', (route) => json(route, []))
  await context.route('**/rest/v1/vaults*', (route) => {
    const url = route.request().url()
    return json(route, url.includes('id=eq.') ? ligneCoffre() : [ligneCoffre()])
  })

  await context.route('**/rest/v1/rpc/**', async (route) => {
    const nom = new URL(route.request().url()).pathname.split('/').pop()
    const corps = JSON.parse(route.request().postData() || '{}')

    switch (nom) {
      case 'vault_intro':
        return json(route, intro(proprietaire))

      case 'vault_open':
        if (corps.p_verifier !== motDePasse.verifier) {
          return json(route, { ok: false, error: 'password', attemptsLeft: 4 })
        }
        return json(route, { ok: true, wrap: motDePasse.wrap, token: nouveauJeton() })

      case 'vault_set_biometric':
        etat.biometric = corps.p_biometric
        etat.biometricWrap = corps.p_wrap
        etat.biometricVerifier = corps.p_verifier || null
        return json(route, null)

      case 'vault_open_biometric': {
        if (!etat.biometricWrap) return json(route, { ok: false, error: 'biometric_disabled' })
        // La règle du serveur : pas de preuve, pas d'enveloppe.
        if (!etat.biometricVerifier || corps.p_verifier !== etat.biometricVerifier) {
          etat.refusBiometriques += 1
          return json(route, { ok: false, error: 'biometric', attemptsLeft: 4 })
        }
        etat.ouverturesBiometriques += 1
        return json(route, { ok: true, wrap: etat.biometricWrap, token: nouveauJeton() })
      }

      case 'vault_session_content': {
        if (!etat.jetons.has(corps.p_token)) return json(route, { ok: false, error: 'session' })
        return json(route, {
          ok: true,
          vault: { id: COFFRE, name: etat.nom, folders: [], protection: etat.biometric ? 'password+biometric' : 'password' },
          files: [],
        })
      }

      default:
        return json(route, null)
    }
  })
}

/* -------------------------------------------------------------------- test */

async function scenario({ prf }) {
  console.log(`\nCapteur ${prf ? 'avec extension PRF' : 'sans extension PRF (secret lié à l’appareil)'}`)
  etat.biometric = null
  etat.biometricWrap = null
  etat.biometricVerifier = null
  etat.ouverturesBiometriques = 0
  etat.refusBiometriques = 0

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 420, height: 950 },
    storageState: { cookies: [], origins: [{ origin: BASE, localStorage: [{ name: KEY, value: JSON.stringify(session) }] }] },
  })
  await installerRoutes(context, { proprietaire: true })

  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal',
      hasResidentKey: true, hasUserVerification: true, hasPrf: prf,
      automaticPresenceSimulation: true, isUserVerified: true,
    },
  })

  // ------------------------------------------------ le propriétaire enrôle
  await page.goto(`${BASE}/app/coffres/${COFFRE}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Mot de passe', { timeout: 20000 })
  await page.fill('input[type=password]', MOT_DE_PASSE)
  await page.click('button:has-text("Déverrouiller")')
  await page.waitForSelector('text=Sécurité', { timeout: 20000 })
  await page.click('button:has-text("Sécurité")')
  await page.waitForSelector('text=Déverrouillage biométrique', { timeout: 20000 })
  await page.click('button:has-text("Activer")')
  await page.waitForSelector('text=Biométrie activée sur cet appareil', { timeout: 20000 })

  verifier("l'empreinte est enrôlée", !!etat.biometric, `→ ${etat.biometric ? 'oui' : 'non'}`)
  verifier(
    'le serveur reçoit un vérificateur, pas seulement une enveloppe',
    typeof etat.biometricVerifier === 'string' && etat.biometricVerifier.length > 20,
  )
  verifier("l'extension PRF est détectée comme attendu", !!etat.biometric?.prfSupported === prf,
    `→ prfSupported=${etat.biometric?.prfSupported}`)

  // ------------------------------- la page du QR Code, sans compte ouvert
  await page.evaluate((cle) => window.localStorage.removeItem(cle), KEY)
  await context.unroute('**/rest/v1/rpc/**')
  await installerRoutes(context, { proprietaire: false })

  await page.goto(`${BASE}/coffre/${COFFRE}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Coffre Sécurité', { timeout: 20000 })
  const bouton = page.locator('button:has-text("Utiliser mon empreinte")')
  verifier("le bouton d'empreinte est proposé sur la page du QR Code", (await bouton.count()) > 0)
  verifier('le nom du coffre reste caché avant ouverture',
    !(await page.locator('h1', { hasText: etat.nom }).count()))

  if (await bouton.count()) {
    await bouton.click()
    // Le déchiffrement passe par deux dérivations PBKDF2 : on laisse le temps.
    await page.waitForSelector('text=Ajouter un fichier', { timeout: 40000 }).catch(() => null)
  }

  const ouvert = (await page.locator('text=Ajouter un fichier').count()) > 0
    || (await page.locator(`text=${etat.nom}`).count()) > 0
  verifier('le coffre s’ouvre au doigt, sans compte ni mot de passe', ouvert)
  verifier('le serveur a bien validé une preuve biométrique', etat.ouverturesBiometriques === 1,
    `→ ${etat.ouverturesBiometriques} ouverture(s), ${etat.refusBiometriques} refus`)

  // ------------------------------------ un appareil non enrôlé est refusé
  await cdp.send('WebAuthn.clearCredentials', { authenticatorId })
  await page.goto(`${BASE}/coffre/${COFFRE}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Coffre Sécurité', { timeout: 20000 })
  const boutonRefus = page.locator('button:has-text("Utiliser mon empreinte")')
  if (await boutonRefus.count()) {
    await boutonRefus.click()
    await page.waitForTimeout(3000)
  }
  const contenuVisible = (await page.locator('text=Ajouter un fichier').count()) > 0
  verifier('un appareil non enrôlé n’ouvre rien', !contenuVisible)
  verifier("le serveur n'a livré aucune enveloppe de plus", etat.ouverturesBiometriques === 1,
    `→ ${etat.ouverturesBiometriques} ouverture(s)`)

  await browser.close()
}

await scenario({ prf: true })
await scenario({ prf: false })

console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nTout est conforme.')
process.exit(echecs.length ? 1 : 0)
