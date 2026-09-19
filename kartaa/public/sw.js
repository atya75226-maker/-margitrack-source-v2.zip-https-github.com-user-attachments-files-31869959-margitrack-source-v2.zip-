/* eslint-env serviceworker */
/**
 * Service worker de Kartaa.
 *
 * Il rend l'application installable et utilisable quand le réseau flanche, sans
 * jamais mettre en cache ce qui ne doit pas l'être.
 *
 * CE QUI N'EST JAMAIS MIS EN CACHE
 *
 *  - tout ce qui ne vient pas de ce domaine : appels à Supabase, URL signées des
 *    jetons d'authentification. Un jeton qui traînerait dans un cache du
 *    navigateur serait une fuite ;
 *  - toute requête qui n'est pas un GET.
 *
 * DEUX STRATÉGIES
 *
 *  - les pages : le réseau d'abord, le cache seulement s'il ne répond pas. Une
 *    application qui affiche une vieille version sans le dire est pire qu'une
 *    application lente ;
 *  - les fichiers versionnés produits par la compilation (/assets/…) : le cache
 *    d'abord, puisque leur nom change à chaque version — ils ne peuvent pas être
 *    périmés.
 *
 * MISE À JOUR
 *
 * Le worker n'appelle pas skipWaiting à l'installation : prendre la main
 * immédiatement rechargerait la page sous les doigts de la personne, parfois en
 * pleine saisie. Il attend que l'application le lui demande, après un clic.
 */

const VERSION = 'kartaa-v2'
const COQUILLE = `${VERSION}-coquille`
const RESSOURCES = `${VERSION}-ressources`

const A_PRECHARGER = ['/', '/manifest.webmanifest', '/favicon.svg', '/icone-192.png', '/icone-512.png']

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches.open(COQUILLE).then((cache) => cache.addAll(A_PRECHARGER)).catch(() => null),
  )
})

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((nom) => !nom.startsWith(VERSION)).map((nom) => caches.delete(nom))))
      .then(() => self.clients.claim()),
  )
})

// L'application demande explicitement le passage à la nouvelle version.
self.addEventListener('message', (evenement) => {
  if (evenement.data === 'appliquer-la-mise-a-jour') self.skipWaiting()
})

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request
  if (requete.method !== 'GET') return

  const url = new URL(requete.url)
  if (url.origin !== self.location.origin) return // Supabase, URL signées : jamais ici.

  // Fichiers versionnés : leur nom contient une empreinte, le cache ne peut pas mentir.
  if (url.pathname.startsWith('/assets/')) {
    evenement.respondWith(
      caches.match(requete).then((enCache) => {
        if (enCache) return enCache
        return fetch(requete).then((reponse) => {
          if (reponse.ok) {
            const copie = reponse.clone()
            caches.open(RESSOURCES).then((cache) => cache.put(requete, copie))
          }
          return reponse
        })
      }),
    )
    return
  }

  // Navigation : le réseau d'abord, la coquille en secours hors ligne.
  if (requete.mode === 'navigate') {
    evenement.respondWith(
      fetch(requete)
        .then((reponse) => {
          const copie = reponse.clone()
          caches.open(COQUILLE).then((cache) => cache.put('/', copie))
          return reponse
        })
        .catch(() => caches.match('/').then((enCache) => enCache || Response.error())),
    )
  }
})
