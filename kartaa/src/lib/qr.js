import QRCode from 'qrcode'

/**
 * Un QR Code Kartaa ne contient jamais de données personnelles ni de fichier :
 * uniquement l'adresse du mini-site public.
 */
export async function qrDataUrl(value, { size = 640, dark = '#141728', light = '#ffffff', margin = 1 } = {}) {
  return QRCode.toDataURL(value, {
    width: size,
    margin,
    errorCorrectionLevel: 'M',
    color: { dark, light },
  })
}

export async function qrSvg(value, options = {}) {
  return QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', ...options })
}

/**
 * Le même code, mais vectoriel, prêt à être posé dans une balise `img`.
 *
 * C'est la forme qui convient à une carte destinée à l'impression : le dessin
 * est recalculé à la résolution du fichier produit, quelle que soit sa taille.
 * Une image matricielle, elle, finit par montrer ses pixels dès qu'on
 * l'agrandit — et un QR Code flou est un QR Code qui ne se scanne pas.
 *
 * La marge par défaut est plus large qu'ailleurs : c'est la zone calme, ce
 * blanc autour du code sans lequel beaucoup de téléphones renoncent.
 */
export async function qrSvgDataUrl(value, { dark = '#141728', light = '#ffffff', margin = 2 } = {}) {
  const svg = await qrSvg(value, { margin, color: { dark, light } })
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
