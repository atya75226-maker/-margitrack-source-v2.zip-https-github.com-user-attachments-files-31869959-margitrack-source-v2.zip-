import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, readableError } from '../lib/supabaseClient'
import { repo } from '../lib/storage'
import { lockAll } from '../lib/vaultSession'

const AuthContext = createContext(null)

/**
 * Profil provisoire déduit du jeton, sans aucun appel réseau.
 * Les fournisseurs ne nomment pas les champs de la même façon : notre formulaire
 * envoie first_name, Google envoie given_name ou un nom complet.
 */
function userFromSession(authUser) {
  const meta = authUser.user_metadata || {}
  const complet = (meta.full_name || meta.name || '').trim()
  return {
    id: authUser.id,
    firstName: meta.first_name || meta.given_name || complet.split(' ')[0] || '',
    lastName: meta.last_name || meta.family_name || complet.split(' ').slice(1).join(' ') || '',
    email: authUser.email || '',
    phone: meta.phone || authUser.phone || '',
    avatarUrl: meta.avatar_url || meta.picture || '',
    plan: 'free',
  }
}

/**
 * Authentification déléguée à Supabase Auth : mots de passe hachés côté serveur,
 * jetons rafraîchis automatiquement. Le profil (prénom, nom, téléphone, offre) vit
 * dans la table `profiles`, créée par déclencheur à l'inscription.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setUser(null)
      return null
    }
    const profile = await repo.users.get(authUser.id).catch(() => null)
    const meta = authUser.user_metadata || {}
    const complet = (meta.full_name || meta.name || '').trim()
    const merged = profile || {
      id: authUser.id,
      firstName: meta.first_name || meta.given_name || complet.split(' ')[0] || '',
      lastName: meta.last_name || meta.family_name || complet.split(' ').slice(1).join(' ') || '',
      email: authUser.email || '',
      phone: meta.phone || authUser.phone || '',
      avatarUrl: meta.avatar_url || meta.picture || '',
      plan: 'free',
    }
    setUser(merged)
    return merged
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session?.user) setUser(userFromSession(data.session.user))
      // L'application s'ouvre dès que la session est connue : le profil complet
      // arrive ensuite, sans retenir l'affichage si le réseau est lent.
      setReady(true)
      loadProfile(data.session?.user)
    })

    // Ce rappel s'exécute en tenant le verrou d'authentification de Supabase :
    // toute requête lancée ici redemanderait la session et attendrait ce même
    // verrou, ce qui bloque l'application et finit par la faire passer pour
    // déconnectée. On enregistre donc la session immédiatement, et on charge le
    // profil une fois sorti de la pile d'appel.
    const { data: listener } = supabase.auth.onAuthStateChange((evenement, nextSession) => {
      setSession(nextSession)
      setReady(true)
      if (nextSession?.user) setUser(userFromSession(nextSession.user))
      if (evenement === 'TOKEN_REFRESHED') return // même utilisateur : rien à recharger
      setTimeout(() => {
        if (active) loadProfile(nextSession?.user)
      }, 0)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signUp = useCallback(async ({ firstName, lastName, email, phone, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { first_name: firstName.trim(), last_name: lastName.trim(), phone: (phone || '').trim() } },
    })
    if (error) throw new Error(readableError(error, "L'inscription a échoué."))
    // Si la confirmation d'e-mail est exigée par le projet, aucune session n'est ouverte.
    if (!data.session) {
      return { pendingConfirmation: true, email: email.trim().toLowerCase() }
    }
    await loadProfile(data.user)
    return { pendingConfirmation: false }
  }, [loadProfile])

  /**
   * Connexion par Google. La page quitte l'application vers Google, puis revient
   * sur /auth/callback ; c'est le client Supabase qui récupère la session dans
   * l'URL de retour (detectSessionInUrl).
   */
  const signInWithGoogle = useCallback(async (next = '/app') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) throw new Error(readableError(error, "La connexion avec Google n'a pas abouti."))
  }, [])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw new Error(readableError(error, 'Connexion impossible.'))
    return loadProfile(data.user)
  }, [loadProfile])

  const signOut = useCallback(async () => {
    lockAll()
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }, [])

  const updateUser = useCallback(async (patch) => {
    const updated = await repo.users.update(user.id, patch)
    setUser(updated)
    return updated
  }, [user])

  const value = useMemo(
    () => ({ user, session, ready, signUp, signIn, signInWithGoogle, signOut, updateUser, isAuthenticated: !!session }),
    [user, session, ready, signUp, signIn, signInWithGoogle, signOut, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return context
}
