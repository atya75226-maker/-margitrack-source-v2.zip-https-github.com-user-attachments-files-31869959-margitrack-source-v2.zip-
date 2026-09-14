/**
 * Vérification hors ligne du scanner de QR Codes.
 *
 *   npm run test:scanner
 *
 * Génère de vrais QR Codes, les relit avec le même moteur que le navigateur
 * (jsQR), puis vérifie que l'application les aiguille correctement : une carte
 * Kartaa s'ouvre en interne, un site extérieur est proposé à l'ouverture, un
 * numéro devient appelable, le reste s'affiche en texte.
 */
// Vérifie la chaîne complète : QR généré → décodé par jsQR → interprété par l'application.
globalThis.window = { location: { origin: 'https://kartaa-eight.vercel.app' } }

const QRCode = (await import('qrcode')).default
const jsQR = (await import('jsqr')).default
const { PNG } = await import('pngjs')
const { interpretScan } = await import('../src/lib/qrScanner.js')

let echecs = 0
const verifier = (intitule, condition, detail = '') => {
  if (!condition) echecs += 1
  console.log(`${condition ? '  ok  ' : ' ÉCHEC'}  ${intitule}${detail ? ' — ' + detail : ''}`)
}

async function allerRetour(texte) {
  const buffer = await QRCode.toBuffer(texte, { width: 400, margin: 2 })
  const png = PNG.sync.read(buffer)
  const lu = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, { inversionAttempts: 'attemptBoth' })
  return lu?.data ?? null
}

console.log('\nScanner de QR Codes\n')

const cas = [
  ['carte Kartaa',        'https://kartaa-eight.vercel.app/aziz',                 'card',     '/aziz'],
  ['coffre Kartaa',       'https://kartaa-eight.vercel.app/c/88f7b65d-ee2f',      'vault',    '/c/88f7b65d-ee2f'],
  ['page interne',        'https://kartaa-eight.vercel.app/app/cartes',           'internal', '/app/cartes'],
  ['site extérieur',      'https://www.orange.ci/offres',                          'url',      null],
  ['numéro de téléphone', '+225 07 00 12 34 56',                                   'phone',    null],
  ['texte libre',         'Rendez-vous mardi 14h au bureau',                       'text',     null],
]

for (const [intitule, contenu, typeAttendu, routeAttendue] of cas) {
  const relu = await allerRetour(contenu)
  verifier(`${intitule} : relu à l'identique`, relu === contenu, relu === contenu ? '' : `lu « ${relu} »`)
  const lecture = interpretScan(relu || '')
  verifier(`${intitule} : reconnu comme « ${typeAttendu} »`, lecture.kind === typeAttendu, `obtenu « ${lecture.kind} »`)
  if (routeAttendue) {
    verifier(`${intitule} : ouvre ${routeAttendue}`, lecture.route === routeAttendue, `obtenu « ${lecture.route} »`)
  }
}

// Une vCard exportée par Kartaa doit être reconnue comme un contact
const vcard = 'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Awa Traoré\r\nTEL;TYPE=CELL:+225070012\r\nEND:VCARD'
const lectureVcard = interpretScan(vcard)
verifier('fiche contact reconnue', lectureVcard.kind === 'vcard', `obtenu « ${lectureVcard.kind} »`)
verifier('nom extrait de la fiche', lectureVcard.label === 'Awa Traoré', `obtenu « ${lectureVcard.label} »`)

// Un contenu vide ne doit rien déclencher
verifier('contenu vide ignoré', interpretScan('   ').kind === 'empty')

console.log(echecs === 0 ? '\nTout est conforme.\n' : `\n${echecs} vérification(s) en échec.\n`)
process.exit(echecs === 0 ? 0 : 1)
