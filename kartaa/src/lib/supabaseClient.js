import { createClient } from '@supabase/supabase-js'

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
  },
})

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
