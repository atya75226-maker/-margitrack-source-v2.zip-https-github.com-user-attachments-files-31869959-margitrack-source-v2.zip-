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

function fileNameOf(card, extension) {
  const p = card.profile || {}
  const base = [p.firstName, p.lastName].filter(Boolean).join('-').toLowerCase() || card.slug || 'carte'
  return `carte-${base}.${extension}`
}

/**
 * Exporte la carte. `nodes` contient le recto et (facultatif) le verso :
 * le PDF reprend les deux faces, le PNG/JPG exporte le recto.
 */
export async function exportCard(card, nodes, format = 'png') {
  const { front, back } = nodes
  if (!front) throw new Error("La carte n'est pas prête à être exportée.")

  if (format === 'png' || format === 'jpg') {
    const dataUrl = await render(front, format)
    downloadUrl(dataUrl, fileNameOf(card, format))
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
