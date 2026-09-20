/**
 * La page d'accueil ne promet que ce qui existe (Playwright).
 *
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/vitrine-check.mjs
 *
 * Une vitrine se démode plus vite que le produit : on retire une
 * fonctionnalité, la page continue de la vendre. Ce contrôle relit donc la page
 * telle qu'un visiteur la reçoit et vérifie deux choses :
 *
 *   • qu'aucun chantier non branché n'y est présenté comme disponible ;
 *   • que la démonstration est bien le composant réel du profil, et qu'elle est
 *     annoncée comme un exemple.
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

/**
 * Ce qui n'est pas branché (voir FEATURE_FLAGS et le README).
 *
 * Le NFC n'y figure plus : il fonctionne réellement depuis que l'application
 * écrit l'adresse du profil sur la puce (voir `npm run test:nfc`).
 *
 * Le mot peut apparaître pour dire qu'il n'est PAS disponible — c'est le rôle
 * du pied de page. Ce qui est interdit, c'est de le présenter comme une
 * fonctionnalité : on vérifie donc son absence des listes et des titres.
 */
const NON_BRANCHE = ['domaine personnalisé', 'impression de cartes', 'cartes physiques livrées']

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'fr-FR' })
// Aucun compte, aucune donnée : la page d'accueil doit tenir toute seule.
await context.route('**://*.supabase.co/**', (route) => route.abort('failed'))

const page = await context.newPage()
const erreurs = []
page.on('pageerror', (erreur) => erreurs.push(String(erreur)))

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Comment ça marche', { timeout: 20000 })
await page.waitForTimeout(2000)

const texte = await page.innerText('body')

console.log('\nAucune promesse qui n’existe pas')
for (const mot of NON_BRANCHE) {
  const present = new RegExp(mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(texte)
  // Seule exception tolérée : la phrase du pied de page qui dit précisément
  // que ces chantiers ne sont pas branchés.
  const dansLAvertissement = /ne sont pas encore branchés/.test(texte)
  verifier(`« ${mot} » n’est pas présenté comme disponible`, !present || dansLAvertissement,
    `→ trouvé dans la page`)
}
verifier('le pied de page dit ce qui n’est pas branché', /ne sont pas encore branchés/.test(texte))
verifier('aucune mention « aucun paiement n’est prélevé »', !/aucun paiement n['’]est/i.test(texte))

console.log('\nLe produit réel est montré')
verifier('la démonstration est annoncée comme un exemple', /données de démonstration/i.test(texte))
// Marqueurs du composant de profil : ce sont ses propres libellés.
verifier('le profil affiché est le composant réel', /MES RÉSEAUX/i.test(texte) && /Enregistrer le contact/i.test(texte))
verifier('les trois profils d’exemple sont proposés',
  (await page.locator('button:has-text("Consultante en marketing digital")').count()) > 0)

const reseaux = await page.locator('[aria-label], a[href^="#"]').count()
verifier('la page se charge sans erreur JavaScript', erreurs.length === 0, `→ ${erreurs[0] || ''}`)
verifier('la page est complète', reseaux > 0 && texte.length > 1500, `→ ${texte.length} caractères`)

console.log('\nLa scène d’accueil')
// La scène du hero : deux personnes, une carte, un téléphone. Elle est décrite
// pour ceux qui ne la voient pas.
verifier('la scène du haut de page est décrite pour les lecteurs d’écran',
  (await page.locator('svg[role="img"][aria-label*="tend sa carte"]').count()) > 0)
verifier('le téléphone de la scène montre le vrai profil',
  (await page.locator('.scene-ecran-profil').count()) > 0
  && (await page.locator('.scene-ecran-profil').innerText()).includes('Awa Traoré'))
verifier('la carte de la scène est le vrai recto Kartaa',
  (await page.locator('.scene-carte').innerText()).trim() === 'Kartaa',
  `→ ${(await page.locator('.scene-carte').innerText()).trim()}`)
verifier('la scène du bureau est décrite elle aussi',
  (await page.locator('svg[role="img"][aria-label*="bureau"]').count()) > 0)
// Aucune photo d'inconnu, et rien à télécharger ailleurs : les images de cette
// page viennent toutes de l'application elle-même.
const imagesExterieures = await page.evaluate(() => [...document.images]
  .map((image) => image.currentSrc || image.src)
  .filter((source) => /^https?:/i.test(source) && !source.startsWith(window.location.origin)))
verifier('aucune image ne vient d’ailleurs', imagesExterieures.length === 0,
  `→ ${imagesExterieures.join(', ')}`)
verifier('la carte de la scène porte un vrai QR Code',
  (await page.locator('img[alt="QR Code"][src^="data:image/svg+xml"]').count()) > 0)

console.log('\nLes chemins mènent où ils disent')
const lien = async (texteBouton) => page.locator(`a:has-text("${texteBouton}")`).first().getAttribute('href')
verifier('« Commencer gratuitement » mène à l’inscription', (await lien('Commencer gratuitement')) === '/inscription')
verifier('« Passer à Pro » mène au vrai parcours', ['/inscription', '/app/abonnement'].includes(await lien('Passer à Pro')),
  `→ ${await lien('Passer à Pro')}`)
verifier('« Voir la démo » reste sur la page, vers la démonstration réelle',
  (await lien('Voir la démo')) === '#profil', `→ ${await lien('Voir la démo')}`)
verifier('le prix affiché est 5 000 FCFA', /5\s?000\s*FCFA/.test(texte))
verifier('aucune autre offre payante n’est nommée',
  !/Premium\s*[—:-]\s*\d|VIP\s*[—:-]\s*\d|abonnement (Premium|VIP)/i.test(texte))

console.log('\nL’écran du téléphone, à toutes les tailles')
/*
 * Le profil est rendu à sa largeur mobile réelle puis réduit. Si l'échelle ne
 * suit pas la taille de l'écran, la page déborde et l'on n'en voit qu'une
 * bande — c'est arrivé : sur un téléphone, le profil était rendu deux fois et
 * demie trop large et l'en-tête coloré passait pour un écran vide.
 */
for (const largeur of [360, 412, 768, 1280]) {
  await page.setViewportSize({ width: largeur, height: 900 })
  await page.waitForTimeout(700)
  const mesures = await page.evaluate(() => {
    const ecran = document.querySelector('.scene-ecran-profil')
    const contenu = ecran?.firstElementChild
    if (!ecran || !contenu) return null
    const cadre = ecran.getBoundingClientRect()
    const page = contenu.getBoundingClientRect()
    return {
      ecran: cadre.width,
      profil: page.width,
      debordeAGauche: page.left - cadre.left,
      alignementHaut: page.top - cadre.top,
    }
  })
  verifier(`à ${largeur} px, le profil occupe exactement l’écran`,
    mesures && Math.abs(mesures.profil - mesures.ecran) <= 1,
    `→ écran ${Math.round(mesures?.ecran)} px, profil ${Math.round(mesures?.profil)} px`)
  verifier(`à ${largeur} px, il est aligné sur le bord de l’écran`,
    mesures && Math.abs(mesures.debordeAGauche) <= 1 && Math.abs(mesures.alignementHaut) <= 1,
    `→ décalage ${Math.round(mesures?.debordeAGauche)} / ${Math.round(mesures?.alignementHaut)} px`)
}
await page.setViewportSize({ width: 1280, height: 1000 })
await page.waitForTimeout(500)

console.log('\nSur un téléphone')
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(800)
const debordement = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
verifier('rien ne déborde horizontalement', !debordement)

await browser.close()
console.log(echecs.length ? `\n${echecs.length} échec(s).` : '\nTout est conforme.')
process.exit(echecs.length ? 1 : 0)
