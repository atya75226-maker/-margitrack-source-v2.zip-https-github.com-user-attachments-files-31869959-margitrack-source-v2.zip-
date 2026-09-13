import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { repo, revokeAllUrls } from '../lib/storage'
import { lockAll } from '../lib/vaultSession'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const userId = repo.session.get()
    if (!userId) {
      setReady(true)
      return
    }
    repo.users.get(userId).then((found) => {
      setUser(found)
      if (!found) repo.session.clear()
      setReady(true)
    })
  }, [])

  const signUp = useCallback(async (payload) => {
    const created = await repo.users.create(payload)
    repo.session.set(created.id)
    setUser(created)
    return created
  }, [])

  const signIn = useCallback(async (email, password) => {
    const found = await repo.users.authenticate(email, password)
    repo.session.set(found.id)
    setUser(found)
    return found
  }, [])

  const signOut = useCallback(() => {
    lockAll()
    revokeAllUrls()
    repo.session.clear()
    setUser(null)
  }, [])

  const updateUser = useCallback(async (patch) => {
    const updated = await repo.users.update(user.id, patch)
    setUser(updated)
    return updated
  }, [user])

  const value = useMemo(
    () => ({ user, ready, signUp, signIn, signOut, updateUser, isAuthenticated: !!user }),
    [user, ready, signUp, signIn, signOut, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return context
}
