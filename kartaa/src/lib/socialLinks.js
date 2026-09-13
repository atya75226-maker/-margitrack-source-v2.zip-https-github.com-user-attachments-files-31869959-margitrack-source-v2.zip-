import { SOCIAL_NETWORKS, NETWORK_BY_KEY } from '../config/app.config'
import { ensureHttp, whatsappHref } from './format'

/**
 * Aides partagées autour des liens d'une carte.
 * Une carte peut porter plusieurs comptes par plateforme : ces fonctions servent
 * à les préparer pour le formulaire, la carte imprimée et le mini-site.
 */

/** Ajoute une ligne vide pour chaque plateforme absente, afin que le formulaire en montre toujours une. */
export function ensureRows(links = []) {
  const withUid = links.map((link) => ({ ...link, uid: link.uid || link.id || crypto.randomUUID() }))
  const missing = SOCIAL_NETWORKS
    .filter((network) => !withUid.some((link) => link.platform === network.key))
    .map((network) => ({ uid: crypto.randomUUID(), platform: network.key, title: '', url: '', isActive: true }))
  return [...withUid, ...missing]
}

/** Ne conserve que les liens réellement renseignés et actifs. */
export function activeLinks(links = []) {
  return links.filter((link) => (link.url || '').trim() && link.isActive !== false)
}

/** Regroupe par plateforme, dans l'ordre de la configuration. */
export function groupByPlatform(links = []) {
  const active = activeLinks(links)
  return SOCIAL_NETWORKS
    .map((network) => ({ network, items: active.filter((link) => link.platform === network.key) }))
    .filter((group) => group.items.length > 0)
}

/** Les plateformes présentes, sans doublon : c'est ce qu'affiche la carte. */
export function distinctPlatforms(links = []) {
  const seen = new Set(activeLinks(links).map((link) => link.platform))
  return SOCIAL_NETWORKS.filter((network) => seen.has(network.key))
}

/** Adresse cliquable d'un lien, selon sa plateforme. */
export function linkHref(link) {
  if (!link?.url) return '#'
  return link.platform === 'whatsapp' ? whatsappHref(link.url) : ensureHttp(link.url)
}

/** Libellé affiché : le nom donné par l'utilisateur, sinon le nom de la plateforme. */
export function linkLabel(link, position = 0, total = 1) {
  const network = NETWORK_BY_KEY[link.platform]
  if ((link.title || '').trim()) return link.title.trim()
  if (total > 1) return `${network?.label || link.platform} ${position + 1}`
  return network?.label || link.platform
}
