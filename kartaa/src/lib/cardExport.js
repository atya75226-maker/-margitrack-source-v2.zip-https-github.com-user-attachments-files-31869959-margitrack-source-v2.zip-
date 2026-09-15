import { downloadBlob, downloadUrl } from './download'

const SCALE = 3

// Les bibliothèques d'export sont volumineuses : elles ne sont chargées qu'au
// moment où l'utilisateur télécharge réellement sa carte.
async function render(node, format) {
  const { toPng, toJpeg } = await import('html-to-image')
  const options = {
    pixelRatio: SCALE,
    cacheBust: true,
    backgroundColor: format === 'jpg' ? '#ffffff' : undefined,
    skipFonts: false,
  }
  return format === 'jpg' ? toJpeg(node, { ...options, quality: 0.95 }) : toPng(node, options)
}

const SUFFIXE_FACE = { front: 'recto', back: 'verso' }

function fileNameOf(card, extension, side = null) {
  const p = card.profile || {}
  const base = [p.firstName, p.lastName].filter(Boolean).join('-').toLowerCase() || card.slug || 'carte'
  const face = side ? `-${SUFFIXE_FACE[side] || side}` : ''
  return `carte-${base}${face}.${extension}`
}

/**
 * Exporte la carte.
 *
 * `nodes` contient les deux faces, rendues hors écran à leur taille réelle.
 * `side` dit laquelle exporter en image — c'est la face affichée à l'écran, de
 * sorte que le fichier obtenu soit exactement celui qu'on regardait.
 *
 * Le PDF, lui, reprend toujours les deux faces : une carte imprimée en a deux.
 *
 * Auparavant, PNG et JPG rendaient `front` quelle que soit la face choisie :
 * demander le verso téléchargeait le recto, sans erreur ni signe visible.
 */
export async function exportCard(card, nodes, format = 'png', side = 'front') {
  const { front, back } = nodes
  if (!front) throw new Error("La carte n'est pas prête à être exportée.")

  if (format === 'png' || format === 'jpg') {
    const face = side === 'back' ? back : front
    if (!face) throw new Error("Cette face de la carte n'est pas prête à être exportée.")
    const dataUrl = await render(face, format)
    downloadUrl(dataUrl, fileNameOf(card, format, side))
    return
  }

  const { jsPDF } = await import('jspdf')
  const frontPng = await render(front, 'png')
  const backPng = back ? await render(back, 'png') : null

  const width = front.offsetWidth
  const height = front.offsetHeight
  const pdf = new jsPDF({
    orientation: width >= height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [width, height],
    compress: true,
  })
  pdf.addImage(frontPng, 'PNG', 0, 0, width, height, undefined, 'FAST')
  if (backPng) {
    pdf.addPage([width, height], width >= height ? 'landscape' : 'portrait')
    pdf.addImage(backPng, 'PNG', 0, 0, width, height, undefined, 'FAST')
  }
  downloadBlob(pdf.output('blob'), fileNameOf(card, 'pdf'))
}
