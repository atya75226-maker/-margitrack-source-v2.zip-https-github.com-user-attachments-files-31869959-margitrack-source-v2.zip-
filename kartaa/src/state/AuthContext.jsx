import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, readableError, readStoredSession } from '../lib/supabaseClient'
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

/** Vrai quand le jeton d'accès rangé a dépassé sa durée de vie. */
function accessTokenExpired(session) {
  if (!session?.expires_at) return true
  return session.expires_at * 1000 - Date.now() < 10_000
}

/** Attentes entre deux tentatives de reconnexion, en millisecondes. */
const DELAIS_RECONNEXION = [1000, 3000, 8000, 20000]

/**
 * Authentification déléguée à Supabase Auth : mots de passe hachés côté serveur,
 * jetons rafraîchis automatiquement. Le profil (prénom, nom, téléphone, offre) vit
 * dans la table `profiles`, créée par déclencheur à l'inscription.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  // Vrai quand des jetons valides attendent dans le navigateur mais que le
  // serveur d'authentification est injoignable : ce n'est pas une déconnexion.
  const [reconnecting, setReconnecting] = useState(false)
  const reconnectTimer = useRef(null)
  // Permet au bouton « Réessayer » de relancer la reprise sans recharger la page :
  // un rechargement en plein renouvellement de jeton fait perdre le jeton tournant
  // que le serveur vient d'émettre, et déconnecte alors pour de bon.
  const relancerRef = useRef(() => {})

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

    /**
     * Reprend la session au démarrage, et la retente tant que des jetons
     * attendent dans le navigateur.
     *
     * Le jeton d'accès ne vit qu'une heure. Passé ce délai, le client doit le
     * renouveler auprès du serveur ; si l'appel échoue — réseau coupé, 4G
     * poussive, navigateur intégré d'une autre application — il renvoie une
     * session vide, exactement comme si personne n'était connecté. Renvoyer
     * alors vers l'écran de connexion, c'est déconnecter quelqu'un dont les
     * jetons sont pourtant intacts : c'est ce qui se produisait à chaque retour
     * sur le site. On retente donc, et on ne déconnecte que si le serveur
     * refuse vraiment les jetons.
     */
    const rangee = readStoredSession()

    // Ouverture immédiate quand le jeton d'accès est encore valable : aucun
    // appel réseau n'est nécessaire pour le savoir, autant ne pas faire
    // patienter devant un écran vide.
    if (rangee && !accessTokenExpired(rangee)) {
      setSession(rangee)
      setUser(userFromSession(rangee.user))
      setReady(true)
    } else if (rangee) {
      // Jeton périmé : on annonce la reconnexion pendant que le client renouvelle.
      setReconnecting(true)
      setReady(true)
    }

    const reprendre = async (tentative = 0) => {
      const { data, error } = await supabase.auth.getSession()
      if (!active) return

      if (data.session) {
        setSession(data.session)
        setUser(userFromSession(data.session.user))
        setReconnecting(false)
        setReady(true)
        // Le profil complet arrive ensuite, sans retenir l'affichage.
        loadProfile(data.session.user)
        return
      }

      const encoreRangee = readStoredSession()

      if (encoreRangee && tentative < DELAIS_RECONNEXION.length) {
        setSession(null)
        setReconnecting(true)
        setReady(true)
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = setTimeout(() => {
          if (active) reprendre(tentative + 1)
        }, DELAIS_RECONNEXION[tentative])
        return
      }

      // Plus de jetons en réserve, ou le serveur les a refusés : déconnexion réelle.
      setReconnecting(!!encoreRangee)
      setSession(null)
      setUser(null)
      setReady(true)
    }

    reprendre()

    // Retour du réseau ou de l'application au premier plan : on retente aussitôt
    // plutôt que d'attendre la prochaine échéance.
    const relancer = () => {
      if (!active || document.visibilityState === 'hidden') return
      if (!readStoredSession()) return
      clearTimeout(reconnectTimer.current)
      reprendre()
    }
    relancerRef.current = () => reprendre()
    window.addEventListener('online', relancer)
    document.addEventListener('visibilitychange', relancer)

    // Ce rappel s'exécute en tenant le verrou d'authentification de Supabase :
    // toute requête lancée ici redemanderait la session et attendrait ce même
    // verrou, ce qui bloque l'application et finit par la faire passer pour
    // déconnectée. On enregistre donc la session immédiatement, et on charge le
    // profil une fois sorti de la pile d'appel.
    const { data: listener } = supabase.auth.onAuthStateChange((evenement, nextSession) => {
      // Une déconnexion émise alors que rien n'est rangé dans le navigateur est
      // réelle ; sinon, le client a simplement échoué à renouveler les jetons.
      if (evenement === 'SIGNED_OUT' && readStoredSession()) {
        setReconnecting(true)
        return
      }
      setSession(nextSession)
      setReady(true)
      if (nextSession) setReconnecting(false)
      if (nextSession?.user) setUser(userFromSession(nextSession.user))
      if (evenement === 'TOKEN_REFRESHED') return // même utilisateur : rien à recharger
      setTimeout(() => {
        if (active) loadProfile(nextSession?.user)
      }, 0)
    })

    return () => {
      active = false
      clearTimeout(reconnectTimer.current)
      window.removeEventListener('online', relancer)
      document.removeEventListener('visibilitychange', relancer)
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  /** Relance la reprise de session à la demande, sans recharger la page. */
  const retryAuth = useCallback(() => relancerRef.current(), [])

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
    clearTimeout(reconnectTimer.current)
    setReconnecting(false)
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
    () => ({
      user, session, ready, reconnecting, retryAuth,
      signUp, signIn, signInWithGoogle, signOut, updateUser,
      isAuthenticated: !!session,
    }),
    [user, session, ready, reconnecting, retryAuth, signUp, signIn, signInWithGoogle, signOut, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return context
}
