/**
 * Vérification hors ligne du chiffrement des coffres.
 *
 *   node scripts/crypto-check.mjs      (ou : npm run test:crypto)
 *
 * Ne demande ni réseau ni navigateur : il exerce directement src/lib/crypto.js,
 * c'est-à-dire le code qui protège réellement les fichiers. Il vérifie les
 * propriétés dont dépend tout le reste :
 *   - un mot de passe faux ne déchiffre pas la clé du coffre ;
 *   - le vérificateur envoyé au serveur ne permet pas de la déchiffrer ;
 *   - le code de récupération ouvre le même coffre que le mot de passe ;
 *   - après réinitialisation, les fichiers déjà chiffrés restent lisibles.
 */

import {
  generateVaultKey, wrapVaultKey, openWrappedKey, deriveVaultMaterial,
  encryptBytes, decryptBytes, fromBase64, generateRecoveryCode,
  normalizeRecoveryCode, KDF_ITERATIONS,
} from '../src/lib/crypto.js'

let echecs = 0

function verifier(intitule, condition) {
  const ok = condition === true
  if (!ok) echecs += 1
  console.log(`${ok ? '  ok  ' : ' ÉCHEC'}  ${intitule}`)
}

async function refuse(intitule, action) {
  try {
    await action()
    verifier(intitule, false)
  } catch {
    verifier(intitule, true)
  }
}

const MOT_DE_PASSE = 'CoffreSecret2024!'
const texte = new TextEncoder().encode('Diplôme confidentiel — contenu secret 12345')
const lire = (octets) => new TextDecoder().decode(octets)

console.log('\nChiffrement du Coffre Sécurité\n')

// --- Création ---------------------------------------------------------------
const cleDuCoffre = await generateVaultKey()
const codeDeRecuperation = generateRecoveryCode()
const parMotDePasse = await wrapVaultKey(cleDuCoffre, MOT_DE_PASSE)
const parCode = await wrapVaultKey(cleDuCoffre, codeDeRecuperation)

verifier('le code de récupération a la forme XXXX-XXXX-XXXX',
  /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codeDeRecuperation))
verifier('il ne contient ni I, ni O, ni 0, ni 1 (lecture sans ambiguïté)',
  !/[IO01]/.test(codeDeRecuperation))
verifier('deux enveloppes différentes pour la même clé',
  parMotDePasse.wrap.data !== parCode.wrap.data)
verifier('sels distincts pour le mot de passe et le code',
  parMotDePasse.salt !== parCode.salt)

// --- Un fichier, chiffré comme le ferait addFile() ---------------------------
const fichier = await encryptBytes(cleDuCoffre, texte)
verifier('le chiffré ne contient pas le texte en clair',
  !lire(new Uint8Array(fichier.data)).includes('contenu secret'))

// --- Ouverture ---------------------------------------------------------------
const { wrappingKey, verifier: verificateur } =
  await deriveVaultMaterial(MOT_DE_PASSE, parMotDePasse.salt, KDF_ITERATIONS)
verifier('le vérificateur envoyé au serveur est bien celui calculé à la création',
  verificateur === parMotDePasse.verifier)

const cleRetrouvee = await openWrappedKey(parMotDePasse.wrap, wrappingKey)
verifier('le mot de passe rouvre le fichier',
  lire(new Uint8Array(await decryptBytes(cleRetrouvee, fichier.iv, fichier.data)))
    === 'Diplôme confidentiel — contenu secret 12345')

// --- Ce qui doit échouer ------------------------------------------------------
const mauvais = await deriveVaultMaterial('MauvaisMotDePasse', parMotDePasse.salt, KDF_ITERATIONS)
verifier('un mauvais mot de passe ne produit pas le bon vérificateur',
  mauvais.verifier !== parMotDePasse.verifier)
await refuse('un mauvais mot de passe ne déchiffre pas la clé du coffre',
  () => openWrappedKey(parMotDePasse.wrap, mauvais.wrappingKey))

// Le serveur ne détient que le vérificateur : il ne doit pas ouvrir le coffre.
const cleDepuisVerificateur = await crypto.subtle.importKey(
  'raw', fromBase64(verificateur), { name: 'AES-GCM' }, false, ['decrypt'])
await refuse('le vérificateur connu du serveur ne déchiffre pas la clé du coffre',
  () => openWrappedKey(parMotDePasse.wrap, cleDepuisVerificateur))

await refuse('un chiffré modifié est rejeté (AES-GCM authentifié)', async () => {
  // .slice() copie : new Uint8Array(buffer) ne ferait qu'une vue, et modifier
  // l'octet corromprait le chiffré d'origine pour les vérifications suivantes.
  const altere = new Uint8Array(fichier.data).slice()
  altere[5] ^= 0xff
  return decryptBytes(cleRetrouvee, fichier.iv, altere)
})

// --- Récupération -------------------------------------------------------------
const saisieUtilisateur = codeDeRecuperation.toLowerCase().replace(/-/g, ' ')
verifier('la saisie du code tolère espaces et minuscules',
  normalizeRecoveryCode(saisieUtilisateur) === codeDeRecuperation)

const parCodeMateriel = await deriveVaultMaterial(codeDeRecuperation, parCode.salt, KDF_ITERATIONS)
const cleParCode = await openWrappedKey(parCode.wrap, parCodeMateriel.wrappingKey)
verifier('le code de récupération ouvre le même coffre',
  lire(new Uint8Array(await decryptBytes(cleParCode, fichier.iv, fichier.data)))
    === 'Diplôme confidentiel — contenu secret 12345')

// --- Rotation -------------------------------------------------------------------
const NOUVEAU = 'NouveauSecret2024!'
const nouveauCode = generateRecoveryCode()
const nouvelleEnveloppe = await wrapVaultKey(cleParCode, NOUVEAU)
const nouvelleEnveloppeCode = await wrapVaultKey(cleParCode, nouveauCode)

const apresRotation = await deriveVaultMaterial(NOUVEAU, nouvelleEnveloppe.salt, KDF_ITERATIONS)
const cleApresRotation = await openWrappedKey(nouvelleEnveloppe.wrap, apresRotation.wrappingKey)
verifier('après réinitialisation, les fichiers déjà chiffrés restent lisibles',
  lire(new Uint8Array(await decryptBytes(cleApresRotation, fichier.iv, fichier.data)))
    === 'Diplôme confidentiel — contenu secret 12345')
verifier('le nouveau code de récupération diffère de l\'ancien',
  nouveauCode !== codeDeRecuperation && nouvelleEnveloppeCode.verifier !== parCode.verifier)

await refuse('l\'ancien mot de passe ne rouvre pas la nouvelle enveloppe',
  () => openWrappedKey(nouvelleEnveloppe.wrap, wrappingKey))

console.log(echecs === 0 ? '\nTout est conforme.\n' : `\n${echecs} vérification(s) en échec.\n`)
process.exit(echecs === 0 ? 0 : 1)
