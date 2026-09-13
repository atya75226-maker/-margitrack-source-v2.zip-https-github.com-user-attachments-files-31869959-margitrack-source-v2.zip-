import QRCode from 'qrcode'

/**
 * Un QR Code Kartaa ne contient jamais de données personnelles ni de fichier :
 * uniquement une URL (mini-site public, ou page de déverrouillage d'un coffre).
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
