/**
 * Point d'entrée unique du stockage.
 *
 * Toute l'application passe par `repo`. Pour brancher un backend réel, il suffit
 * d'écrire un adaptateur exposant la même API (users, session, cards, vaults)
 * et de l'exporter ici à la place de l'adaptateur local.
 */
export * as repo from './local.adapter'
export { blobs, objectUrl, revokeUrl, revokeAllUrls, ephemeralUrl } from './db'
