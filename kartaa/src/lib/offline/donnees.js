/**
 * Lecture et écriture des données, réseau ou pas.
 *
 * Règle unique : le serveur reste la source de vérité, la base locale en est le
 * reflet. Chaque lecture réussie écrit au passage ce qu'elle a obtenu ; chaque
 * lecture impossible relit ce reflet et le dit clairement.
 *
 * Ce que cette couche NE fait PAS : inventer des données. Si rien n'a jamais été
 * enregistré localement, elle renvoie `null` et l'écran affiche qu'une connexion
 * est nécessaire. Aucun contenu n'est fabriqué pour faire croire que tout va bien.
 */

import { repo } from '../storage'
import * as base from './db'

/**
 * Attente maximale d'une réponse du serveur : lecture, puis écriture.
 *
 * Sans cette limite, une requête partie vers un serveur injoignable ne revient
 * jamais — ni réponse, ni erreur. Le client d'authentification retente son
 * renouvellement de jeton en silence et garde la requête en attente derrière lui.
 * L'écran attendait alors indéfiniment une réponse qui ne viendrait pas, au lieu
 * d'afficher la copie locale : c'est exactement ce qui se passait sans réseau.
 *
 * L'écriture patiente plus longtemps : mieux vaut attendre un envoi lent que le
 * ranger inutilement dans la file.
 */
const ATTENTE_LECTURE = 8000
export const ATTENTE_ECRITURE = 20000

/** Une panne de transport, reconnaissable sans avoir à lire son message. */
function panneReseau(message) {
  const erreur = new Error(message)
  erreur.reseau = true
  return erreur
}

/**
 * Un appel au serveur, borné dans le temps.
 *
 * Quand le navigateur annonce lui-même l'absence de réseau, rien n'est envoyé :
 * inutile d'attendre huit secondes pour apprendre ce qu'on sait déjà.
 */
export function depuisServeur(action, attente = ATTENTE_LECTURE) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.reject(panneReseau('Réseau absent : aucune requête envoyée.'))
  }
  return new Promise((resoudre, rejeter) => {
    let repondu = false
    const minuteur = setTimeout(() => {
      repondu = true
      rejeter(panneReseau('Serveur injoignable : délai dépassé.'))
    }, attente)
    action().then(
      (valeur) => {
        if (repondu) return
        clearTimeout(minuteur)
        resoudre(valeur)
      },
      (erreur) => {
        if (repondu) return
        clearTimeout(minuteur)
        rejeter(erreur)
      },
    )
  })
}

/** Une carte enregistrée localement ne garde que ce qui sert à l'afficher. */
function carteLocale(carte) {
  return {
    id: carte.id,
    userId: carte.userId,
    slug: carte.slug,
    template: carte.template,
    theme: carte.theme,
    profile: carte.profile,
    about: carte.about,
    activities: carte.activities,
    companies: carte.companies,
    services: carte.services,
    gallery: carte.gallery,
    socialLinks: carte.socialLinks,
    customDomain: carte.customDomain,
    scans: carte.scans,
    createdAt: carte.createdAt,
    updatedAt: carte.updatedAt,
  }
}

/**
 * Les cartes du propriétaire.
 * Renvoie toujours `{ cartes, local }` : `local` dit si elles viennent du
 * reflet, pour que l'écran puisse l'annoncer au lieu de faire semblant.
 */
export async function chargerCartes(userId) {
  try {
    const cartes = await depuisServeur(() => repo.cards.listByUser(userId))
    await base.remplacerPour(base.CARTES, userId, cartes.map(carteLocale))
    return { cartes, local: false }
  } catch {
    const locales = await base.pour(base.CARTES, userId)
    return { cartes: locales, local: true }
  }
}

/** Une carte précise, par le même chemin. */
export async function chargerCarte(id) {
  try {
    const carte = await depuisServeur(() => repo.cards.get(id))
    if (carte) await base.ecrire(base.CARTES, { ...carteLocale(carte), userId: carte.userId })
    return { carte, local: false }
  } catch {
    const locale = await base.lire(base.CARTES, id)
    return { carte: locale || null, local: true }
  }
}

/**
 * Un profil public déjà consulté.
 *
 * Une page jamais ouverte sur cet appareil ne peut pas être retrouvée hors
 * ligne : elle n'a jamais été téléchargée. On renvoie alors `null`, et l'écran
 * l'explique — plutôt que de prétendre l'inverse.
 */
export async function chargerProfilPublic(slug) {
  try {
    const profil = await depuisServeur(() => repo.cards.getBySlug(slug))
    if (profil) {
      await base.ecrire(base.PROFILS, { ...profil, slug, consulteLe: new Date().toISOString() })
    }
    return { profil, local: false }
  } catch {
    const locale = await base.lire(base.PROFILS, slug)
    return { profil: locale || null, local: true }
  }
}

/**
 * Disponibilité d'une adresse publique, quand elle peut être vérifiée.
 *
 * Sans réseau, personne ne peut le savoir : on renvoie `verifie: false` plutôt
 * que d'affirmer que l'adresse est libre. L'unicité, elle, ne dépend pas de
 * cette vérification — elle est garantie par une contrainte de la base au moment
 * où la modification part réellement.
 */
export async function verifierAdresse(slug, exceptId = null) {
  try {
    const libre = await depuisServeur(() => repo.cards.slugAvailable(slug, exceptId))
    return { libre, verifie: true }
  } catch {
    // Impossible de savoir : on le dit, et c'est l'enregistrement qui tranchera.
    return { libre: false, verifie: false }
  }
}

/* --------------------------------------------------- modifications en attente */

const ATTENTE_CHANGEE = 'kartaa:attente'

function prevenir() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ATTENTE_CHANGEE))
}

export function surAttenteChangee(rappel) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(ATTENTE_CHANGEE, rappel)
  return () => window.removeEventListener(ATTENTE_CHANGEE, rappel)
}

export function operationsEnAttente() {
  return base.tout(base.ATTENTE)
}

/**
 * Enregistre une modification de carte.
 *
 * En ligne, elle part directement. Hors ligne, elle est rangée dans la file et
 * appliquée tout de suite au reflet local : l'écran montre le résultat sans
 * mentir, puisque la modification est réellement enregistrée sur l'appareil.
 */
export async function enregistrerCarte(id, patch, liens = null) {
  try {
    const carte = await depuisServeur(() => repo.cards.update(id, patch), ATTENTE_ECRITURE)
    if (liens) await depuisServeur(() => repo.cards.saveSocialLinks(id, liens), ATTENTE_ECRITURE)
    await base.ecrire(base.CARTES, { ...carteLocale(carte), userId: carte.userId, socialLinks: liens || carte.socialLinks })
    return { carte, enAttente: false }
  } catch (erreur) {
    if (!estPanneReseau(erreur)) throw erreur

    const locale = await base.lire(base.CARTES, id)
    const fusionnee = locale
      ? { ...locale, ...patch, socialLinks: liens || locale.socialLinks, updatedAt: new Date().toISOString() }
      : null
    if (fusionnee) await base.ecrire(base.CARTES, fusionnee)

    const faiteLe = new Date().toISOString()
    await base.ecrire(base.ATTENTE, {
      id: `carte:${id}:${Date.now()}`,
      type: 'carte.maj',
      carteId: id,
      patch,
      // Sert à départager une modification locale d'une modification faite
      // ailleurs pendant l'absence de réseau.
      faiteLe,
      statut: 'en-attente',
    })
    if (liens) {
      // Remplacer la liste entière est idempotent : rejouer l'opération deux
      // fois donne le même résultat, ce qui la rend sûre dans une file.
      await base.ecrire(base.ATTENTE, {
        id: `liens:${id}:${Date.now()}`,
        type: 'liens.maj',
        carteId: id,
        liens,
        faiteLe,
        statut: 'en-attente',
      })
    }
    prevenir()
    return { carte: fusionnee, enAttente: true }
  }
}

/**
 * Une erreur de réseau, et pas un refus du serveur.
 *
 * Un refus — droits, quota, validation — ne doit surtout pas partir dans la file :
 * il se reproduirait à l'identique au retour du réseau. Seules les pannes de
 * transport sont mises de côté.
 */
export function estPanneReseau(erreur) {
  if (erreur?.reseau) return true
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const message = String(erreur?.message || erreur || '').toLowerCase()
  return /fetch|réseau|network|failed to fetch|load failed|timeout|injoignable|connexion/.test(message)
}

/* ------------------------------------------------------------ synchronisation */

let enCours = false

/**
 * Vide la file au retour du réseau.
 *
 * Chaque opération porte un identifiant : une fois passée, elle est retirée, ce
 * qui interdit tout double envoi. L'ordre est conservé, et le premier échec
 * réseau arrête la boucle — on réessaiera à la prochaine occasion plutôt que de
 * marteler un serveur injoignable.
 *
 * CONFLIT : si la carte a été modifiée ailleurs APRÈS la modification locale, on
 * ne l'écrase pas. L'opération est marquée « conflit » et signalée ; la version
 * du serveur est conservée. C'est la règle la plus simple qui ne perd rien en
 * silence.
 */
export async function synchroniser() {
  if (enCours) return { envoyees: 0, conflits: 0, restantes: 0 }
  enCours = true
  try {
    const operations = (await base.tout(base.ATTENTE))
      .filter((operation) => operation.statut === 'en-attente')
      .sort((a, b) => String(a.faiteLe).localeCompare(String(b.faiteLe)))

    let envoyees = 0
    let conflits = 0

    for (const operation of operations) {
      if (operation.type === 'liens.maj') {
        try {
          await depuisServeur(() => repo.cards.saveSocialLinks(operation.carteId, operation.liens), ATTENTE_ECRITURE)
          await base.supprimer(base.ATTENTE, operation.id)
          envoyees += 1
        } catch (erreur) {
          if (estPanneReseau(erreur)) break
          await base.ecrire(base.ATTENTE, { ...operation, statut: 'refusee', motif: String(erreur?.message || erreur) })
        }
        continue
      }
      if (operation.type !== 'carte.maj') {
        await base.supprimer(base.ATTENTE, operation.id)
        continue
      }
      try {
        const serveur = await depuisServeur(() => repo.cards.get(operation.carteId))
        if (serveur?.updatedAt && String(serveur.updatedAt) > String(operation.faiteLe)) {
          await base.ecrire(base.ATTENTE, { ...operation, statut: 'conflit' })
          conflits += 1
          continue
        }
        const carte = await depuisServeur(() => repo.cards.update(operation.carteId, operation.patch), ATTENTE_ECRITURE)
        await base.ecrire(base.CARTES, { ...carteLocale(carte), userId: carte.userId })
        await base.supprimer(base.ATTENTE, operation.id)
        envoyees += 1
      } catch (erreur) {
        if (estPanneReseau(erreur)) break
        // Refus du serveur : la garder ne servirait à rien, elle serait refusée
        // de la même façon. On la marque pour que rien ne disparaisse en silence.
        await base.ecrire(base.ATTENTE, { ...operation, statut: 'refusee', motif: String(erreur?.message || erreur) })
      }
    }

    const restantes = (await base.tout(base.ATTENTE)).filter((o) => o.statut === 'en-attente').length
    if (envoyees || conflits) prevenir()
    return { envoyees, conflits, restantes }
  } finally {
    enCours = false
  }
}

/** À la déconnexion : le reflet local part avec la session. */
export function oublierToutEnLocal() {
  return base.vider()
}
