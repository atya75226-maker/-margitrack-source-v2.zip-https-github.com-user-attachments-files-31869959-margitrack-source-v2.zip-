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
  return base || `carte-${Math.random().toString(36).slice(2, 7)}`
}

export function publicUrl(slug) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kartaa.app'
  return `${origin}/${slug}`
}

export function vaultUrl(vaultId) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kartaa.app'
  return `${origin}/c/${vaultId}`
}
