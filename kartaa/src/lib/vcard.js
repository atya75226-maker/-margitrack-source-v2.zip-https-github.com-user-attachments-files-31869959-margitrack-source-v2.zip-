import { ensureHttp } from './format'
import { activeLinks } from './socialLinks'

/** Construit un fichier .vcf (contact) à partir d'une carte. */
export function buildVCard(card, photoDataUrl = null) {
  const p = card.profile || {}
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${p.lastName || ''};${p.firstName || ''};;;`,
    `FN:${[p.firstName, p.lastName].filter(Boolean).join(' ')}`,
  ]
  if (p.profession) lines.push(`TITLE:${escape(p.profession)}`)
  const company = (card.companies || [])[0]
  if (company?.name) lines.push(`ORG:${escape(company.name)}`)
  if (p.phone) lines.push(`TEL;TYPE=CELL:${p.phone}`)
  if (p.whatsapp && p.whatsapp !== p.phone) lines.push(`TEL;TYPE=WORK:${p.whatsapp}`)
  if (p.email) lines.push(`EMAIL;TYPE=INTERNET:${p.email}`)
  if (p.address || p.city || p.country) {
    lines.push(`ADR;TYPE=WORK:;;${escape(p.address || '')};${escape(p.city || '')};;;${escape(p.country || '')}`)
  }
  // Tous les liens partent dans la fiche contact, y compris plusieurs par plateforme.
  const links = activeLinks(card.socialLinks)
  links
    .filter((link) => link.platform === 'website' || link.platform === 'other')
    .forEach((link) => lines.push(`URL:${ensureHttp(link.url)}`))
  links
    .filter((link) => !['website', 'other', 'whatsapp'].includes(link.platform))
    .forEach((link) => lines.push(`X-SOCIALPROFILE;TYPE=${link.platform}:${ensureHttp(link.url)}`))
  links
    .filter((link) => link.platform === 'whatsapp')
    .forEach((link) => lines.push(`TEL;TYPE=WHATSAPP:${link.url}`))
  if (card.about) lines.push(`NOTE:${escape(card.about)}`)
  if (photoDataUrl?.startsWith('data:image')) {
    const [meta, data] = photoDataUrl.split(',')
    const type = meta.includes('png') ? 'PNG' : 'JPEG'
    lines.push(`PHOTO;ENCODING=b;TYPE=${type}:${data}`)
  }
  lines.push('END:VCARD')
  return lines.join('\r\n')
}

function escape(value = '') {
  return String(value).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')
}

export function downloadVCard(card, photoDataUrl) {
  const blob = new Blob([buildVCard(card, photoDataUrl)], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const p = card.profile || {}
  link.href = url
  link.download = `${[p.firstName, p.lastName].filter(Boolean).join('-').toLowerCase() || 'contact'}.vcf`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
