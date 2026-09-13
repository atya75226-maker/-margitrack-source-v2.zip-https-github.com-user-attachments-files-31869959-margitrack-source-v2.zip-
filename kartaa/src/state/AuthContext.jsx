import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, readableError } from '../lib/supabaseClient'
import { repo } from '../lib/storage'
import { lockAll } from '../lib/vaultSession'

const AuthContext = createContext(null)

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
    const merged = profile || {
      id: authUser.id,
      firstName: authUser.user_metadata?.first_name || '',
      lastName: authUser.user_metadata?.last_name || '',
      email: authUser.email || '',
      phone: authUser.user_metadata?.phone || '',
      plan: 'free',
    }
    setUser(merged)
    return merged
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session?.user)
      setReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      await loadProfile(nextSession?.user)
      setReady(true)
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
    () => ({ user, session, ready, signUp, signIn, signOut, updateUser, isAuthenticated: !!session }),
    [user, session, ready, signUp, signIn, signOut, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return context
}
