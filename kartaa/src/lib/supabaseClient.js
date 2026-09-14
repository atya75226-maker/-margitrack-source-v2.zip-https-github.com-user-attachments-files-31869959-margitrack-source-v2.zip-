import { createClient } from '@supabase/supabase-js'
import { authStorage } from './authStorage'

/**
 * Connexion au projet Supabase.
 *
 * La clé « publishable » est publique par conception : elle part dans le navigateur
 * de chaque visiteur. Ce qui protège les données, ce sont les politiques Row Level
 * Security et les fonctions vault_* définies dans supabase/migrations, pas le secret
 * de cette clé.
 */

const url = import.meta.env.VITE_SUPABASE_URL || 'https://wadapjshbdjkjrfnsnyr.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'sb_publishable_FO6WOlQ-PGuyEzqoiFfPNQ_czgx3wv-'

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Rangement maison : localStorage quand il fonctionne, cookies sinon.
    // Sans ce repli, les navigateurs qui refusent le stockage DOM perdent la
    // session au moindre rechargement de page (voir lib/authStorage.js).
    storage: authStorage,
  },
})

/**
 * Clé sous laquelle le client range la session — la même que celle qu'il calcule
 * lui-même à partir de la référence du projet.
 */
export const AUTH_STORAGE_KEY = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`

/**
 * Session telle qu'elle est rangée dans le navigateur, sans passer par le client.
 *
 * Elle sert à distinguer deux situations que `getSession()` renvoie de la même
 * façon — une session absente et une session bien présente dont le rafraîchissement
 * vient d'échouer faute de réseau. Sans cette lecture, une coupure de connexion
 * renverrait la personne sur l'écran de connexion alors que ses jetons sont intacts.
 *
 * Des jetons encore rangés valent donc « à retenter » : le client les efface
 * lui-même dès que le serveur les refuse pour de bon.
 */
export function readStoredSession() {
  try {
    const brut = authStorage.getItem(AUTH_STORAGE_KEY)
    if (!brut) return null
    const session = JSON.parse(brut)
    return session?.refresh_token ? session : null
  } catch {
    return null
  }
}

/** Transforme une erreur PostgREST en message affichable. */
export function readableError(error, fallback = "Une erreur est survenue.") {
  if (!error) return fallback
  const message = error.message || error.error_description || ''
  if (/duplicate key|cards_slug_unique/i.test(message)) return 'Cette adresse est déjà utilisée.'
  if (/Invalid login credentials/i.test(message)) return 'E-mail ou mot de passe incorrect.'
  if (/User already registered/i.test(message)) return 'Un compte existe déjà avec cette adresse e-mail.'
  if (/Email not confirmed/i.test(message)) return "Confirmez votre adresse e-mail avant de vous connecter."
  if (/Password should be at least/i.test(message)) return 'Le mot de passe doit contenir au moins 8 caractères.'
  if (/Unsupported provider|provider is not enabled/i.test(message)) {
    return "La connexion avec Google n'est pas activée sur ce projet."
  }
  if (/redirect_uri_mismatch|requested path is invalid/i.test(message)) {
    return "L'adresse de retour n'est pas autorisée dans les réglages d'authentification."
  }
  return message || fallback
}
