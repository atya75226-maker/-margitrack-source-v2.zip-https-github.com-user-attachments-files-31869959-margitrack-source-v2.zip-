/** Transforme « Jean Dupont » en « jean-dupont ». */
export function slugify(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function suggestSlug(firstName, lastName) {
  const base = slugify(`${firstName || ''} ${lastName || ''}`.trim())
  return base.length >= 2 ? base : `carte-${Math.random().toString(36).slice(2, 7)}`
}

/** La base refuse les adresses d'un seul caractère : on complète plutôt que d'échouer. */
export function normalizeSlug(value, firstName, lastName) {
  const clean = slugify(value)
  return clean.length >= 2 ? clean : suggestSlug(firstName, lastName)
}

import { APP } from '../config/app.config'

/** Adresse du mini-site. Toujours sur le domaine de référence, jamais celui du navigateur. */
export function publicUrl(slug) {
  return `${APP.publicOrigin}/${slug}`
}
