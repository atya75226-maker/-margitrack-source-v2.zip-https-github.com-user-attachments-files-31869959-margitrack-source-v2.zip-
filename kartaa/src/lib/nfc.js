/**
 * Puces NFC.
 *
 * Une carte NFC Kartaa ne contient rien d'autre qu'une adresse : celle du
 * mini-site public, la même que le QR Code. Approcher un téléphone d'une puce
 * revient donc exactement à scanner le QR — le téléphone ouvre l'adresse, sans
 * application, sans compte. Aucune donnée personnelle n'est écrite sur la puce :
 * elle serait lisible par n'importe qui, et impossible à corriger ensuite.
 *
 * CE QUE LE NAVIGATEUR SAIT FAIRE, ET CE QU'IL NE SAIT PAS
 *
 * Lire et écrire une puce depuis une page web s'appelle Web NFC. Aujourd'hui,
 * seul Chrome sur Android le propose. Sur iPhone, aucun navigateur ne peut
 * écrire une puce — c'est une limite du système, pas un oubli de notre part, et
 * l'écran le dit au lieu d'afficher un bouton qui ne ferait rien.
 *
 * La lecture, elle, ne dépend pas de nous : les iPhone récents et la plupart
 * des Android lisent une puce programmée sans rien installer. Une carte
 * programmée une fois fonctionne donc partout.
 */

/** Vrai si ce navigateur peut lire et écrire une puce. */
export function nfcDisponible() {
  return typeof window !== 'undefined' && 'NDEFReader' in window
}

/**
 * Pourquoi l'écriture n'est pas possible ici — dit en clair, pas en jargon.
 * Renvoie null quand elle l'est.
 */
export function raisonIndisponible() {
  if (nfcDisponible()) return null
  if (typeof navigator === 'undefined') return "Le NFC n'est pas disponible ici."

  const agent = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(agent)) {
    return "Sur iPhone, aucun navigateur ne peut écrire sur une puce NFC : c'est une limite d'iOS. Programmez la puce depuis un téléphone Android, ou avec une application NFC, en y inscrivant l'adresse ci-dessous."
  }
  if (/Android/i.test(agent)) {
    return "Votre navigateur ne propose pas l'écriture NFC. Sur Android, elle fonctionne avec Chrome — et le NFC doit être activé dans les réglages du téléphone."
  }
  return "L'écriture NFC depuis le navigateur n'existe aujourd'hui que sur Android avec Chrome. Vous pouvez tout de même programmer la puce depuis un téléphone Android, ou avec une application NFC."
}

/** Messages des erreurs que l'API peut réellement renvoyer. */
function messageDErreur(erreur) {
  const nom = erreur?.name || ''
  if (nom === 'NotAllowedError') {
    return "Autorisation refusée. Le navigateur doit pouvoir utiliser le NFC : réessayez et acceptez la demande."
  }
  if (nom === 'NotSupportedError') {
    return "Aucun lecteur NFC utilisable sur cet appareil."
  }
  if (nom === 'NotReadableError') {
    return "Le NFC est éteint sur le téléphone, ou une autre application l'utilise."
  }
  if (nom === 'NetworkError') {
    return "La puce s'est éloignée trop tôt. Gardez-la contre le téléphone jusqu'à la fin."
  }
  if (nom === 'AbortError') return null // annulation voulue : ce n'est pas une erreur
  return erreur?.message || "L'écriture n'a pas abouti."
}

/**
 * Écrit une adresse sur la puce présentée.
 *
 * L'appel doit venir d'un geste de la personne (un clic), et la promesse ne se
 * dénoue qu'au moment où une puce est réellement approchée — d'où le `signal`,
 * qui permet d'abandonner l'attente.
 */
export async function ecrireUrl(url, { signal } = {}) {
  if (!nfcDisponible()) throw new Error(raisonIndisponible())
  const lecteur = new window.NDEFReader()
  try {
    await lecteur.write({ records: [{ recordType: 'url', data: url }] }, { signal })
    return true
  } catch (erreur) {
    const message = messageDErreur(erreur)
    if (message === null) return false // annulé
    throw new Error(message)
  }
}

/**
 * Attend qu'une puce soit approchée et renvoie l'adresse qu'elle contient.
 *
 * Une puce qui ne porte pas d'adresse renvoie `null` : on ne devine pas à sa
 * place, et l'écran le dit.
 */
export async function lireUneEtiquette({ signal } = {}) {
  if (!nfcDisponible()) throw new Error(raisonIndisponible())
  const lecteur = new window.NDEFReader()

  return new Promise((resoudre, rejeter) => {
    const fini = (valeur) => {
      lecteur.onreading = null
      lecteur.onreadingerror = null
      resoudre(valeur)
    }

    lecteur.onreading = (evenement) => {
      const enregistrements = [...(evenement.message?.records || [])]
      const adresse = enregistrements.find((ligne) => ligne.recordType === 'url' || ligne.recordType === 'absolute-url')
      if (adresse) {
        fini({ url: new TextDecoder().decode(adresse.data), serial: evenement.serialNumber || null })
        return
      }
      const texte = enregistrements.find((ligne) => ligne.recordType === 'text')
      if (texte) {
        fini({ url: null, texte: new TextDecoder().decode(texte.data), serial: evenement.serialNumber || null })
        return
      }
      fini({ url: null, texte: null, serial: evenement.serialNumber || null })
    }

    lecteur.onreadingerror = () => {
      fini({ url: null, texte: null, serial: null, illisible: true })
    }

    lecteur.scan({ signal }).catch((erreur) => {
      const message = messageDErreur(erreur)
      if (message === null) resoudre(null)
      else rejeter(new Error(message))
    })
  })
}
