export function formatBytes(bytes = 0) {
  if (!bytes) return '0 Mo'
  const units = ['o', 'Ko', 'Mo', 'Go', 'To']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** index
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`
}

export function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR', options).format(new Date(value))
}

export function formatDateTime(value) {
  return formatDate(value, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function formatNumber(value = 0) {
  return new Intl.NumberFormat('fr-FR').format(value)
}

export function initialsOf(first = '', last = '') {
  return `${(first[0] || '').toUpperCase()}${(last[0] || '').toUpperCase()}` || '?'
}

/** Normalise un numéro pour les liens tel: et wa.me. */
export function telHref(phone = '') {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

export function whatsappHref(phone = '', message = '') {
  const digits = phone.replace(/\D/g, '')
  const text = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${digits}${text}`
}

export function ensureHttp(url = '') {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export function prettyUrl(url = '') {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

export function relativeDays(count) {
  if (count === 0) return "aujourd'hui"
  if (count === 1) return 'hier'
  return `il y a ${count} jours`
}
