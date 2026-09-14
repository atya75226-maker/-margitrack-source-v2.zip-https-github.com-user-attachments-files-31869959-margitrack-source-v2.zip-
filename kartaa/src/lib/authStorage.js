/**
 * Rangement de la session, avec repli quand le navigateur refuse le stockage local.
 *
 * Pourquoi ce fichier existe : côté Supabase, les sessions ne sont jamais
 * expirées par le serveur (aucune limite de durée n'est configurée), et
 * pourtant presque aucune n'est rafraîchie — elles disparaissent de l'appareil
 * avant leur première heure. C'est la signature d'un navigateur qui n'écrit
 * pas localStorage : les fenêtres intégrées à Facebook, Messenger ou
 * Instagram tournent sur un WebView Android où le stockage DOM est souvent
 * désactivé, ou vidé à la fermeture. Le client Supabase bascule alors sur une
 * mémoire vive qui ne survit pas au rechargement de la page : il faut se
 * reconnecter à chaque visite, et même après un simple rafraîchissement.
 *
 * Les cookies, eux, restent écrits par ces mêmes WebViews. On les utilise donc
 * en second recours, puis la mémoire en dernier.
 *
 * Sécurité : un cookie lisible par JavaScript n'expose pas plus les jetons que
 * localStorage — les deux sont accessibles au même code de page. Il n'est ni
 * HttpOnly (le client doit le lire), ni transmis à un autre site (SameSite=Lax,
 * Secure en HTTPS).
 */

const SONDE = '__kartaa_probe__'
const TAILLE_MORCEAU = 3000 // un cookie dépasse rarement 4 096 octets
const UN_AN = 60 * 60 * 24 * 365

function localStorageUtilisable() {
  try {
    window.localStorage.setItem(SONDE, '1')
    const relu = window.localStorage.getItem(SONDE) === '1'
    window.localStorage.removeItem(SONDE)
    return relu
  } catch {
    return false
  }
}

function cookiesUtilisables() {
  try {
    document.cookie = `${SONDE}=1; path=/; SameSite=Lax`
    const relu = document.cookie.includes(`${SONDE}=1`)
    document.cookie = `${SONDE}=; path=/; max-age=0; SameSite=Lax`
    return relu
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ cookies */

function lireCookie(nom) {
  const paires = document.cookie ? document.cookie.split('; ') : []
  const table = new Map(paires.map((paire) => {
    const separateur = paire.indexOf('=')
    return [paire.slice(0, separateur), paire.slice(separateur + 1)]
  }))

  if (table.has(nom)) return decodeURIComponent(table.get(nom))

  // Valeur découpée : nom.0, nom.1, … jusqu'au premier morceau manquant.
  let assemblee = ''
  for (let i = 0; table.has(`${nom}.${i}`); i += 1) assemblee += table.get(`${nom}.${i}`)
  return assemblee ? decodeURIComponent(assemblee) : null
}

function ecrireCookie(nom, valeur) {
  effacerCookie(nom)
  const encodee = encodeURIComponent(valeur)
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  const options = `; path=/; max-age=${UN_AN}; SameSite=Lax${secure}`

  if (encodee.length <= TAILLE_MORCEAU) {
    document.cookie = `${nom}=${encodee}${options}`
    return
  }
  for (let i = 0; i * TAILLE_MORCEAU < encodee.length; i += 1) {
    const morceau = encodee.slice(i * TAILLE_MORCEAU, (i + 1) * TAILLE_MORCEAU)
    document.cookie = `${nom}.${i}=${morceau}${options}`
  }
}

function effacerCookie(nom) {
  const options = '; path=/; max-age=0; SameSite=Lax'
  document.cookie = `${nom}=${options}`
  for (let i = 0; i < 20; i += 1) document.cookie = `${nom}.${i}=${options}`
}

/* ------------------------------------------------------------- construction */

const memoire = new Map()

function choisirSupport() {
  if (typeof window === 'undefined') return 'memoire'
  if (localStorageUtilisable()) return 'local'
  if (cookiesUtilisables()) return 'cookie'
  return 'memoire'
}

/** « local », « cookie » ou « memoire » — utile au diagnostic affiché à l'écran. */
export const STORAGE_KIND = choisirSupport()

export const authStorage = {
  getItem(cle) {
    try {
      if (STORAGE_KIND === 'local') return window.localStorage.getItem(cle)
      if (STORAGE_KIND === 'cookie') return lireCookie(cle)
    } catch {
      /* on retombe sur la mémoire */
    }
    return memoire.has(cle) ? memoire.get(cle) : null
  },
  setItem(cle, valeur) {
    memoire.set(cle, valeur)
    try {
      if (STORAGE_KIND === 'local') window.localStorage.setItem(cle, valeur)
      else if (STORAGE_KIND === 'cookie') ecrireCookie(cle, valeur)
    } catch {
      /* la mémoire a déjà la valeur */
    }
  },
  removeItem(cle) {
    memoire.delete(cle)
    try {
      if (STORAGE_KIND === 'local') window.localStorage.removeItem(cle)
      else if (STORAGE_KIND === 'cookie') effacerCookie(cle)
    } catch {
      /* rien à faire */
    }
  },
}
