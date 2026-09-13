import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { repo } from '../lib/storage'
import { planOf } from '../config/app.config'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { user } = useAuth()
  const [cards, setCards] = useState([])
  const [vaults, setVaults] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setCards([])
      setVaults([])
      setLoading(false)
      return
    }
    const [nextCards, nextVaults] = await Promise.all([
      repo.cards.listByUser(user.id),
      repo.vaults.listByUser(user.id),
    ])
    setCards(nextCards)
    setVaults(nextVaults)
    setLoading(false)
  }, [user])

  useEffect(() => {
    setLoading(true)
    refresh()
    return repo.subscribe(refresh)
  }, [refresh])

  const stats = useMemo(() => {
    const scans = cards.reduce((total, card) => total + (card.scans || 0), 0)
    const usedBytes = vaults.reduce(
      (total, vault) => total + (vault.files || []).reduce((sum, file) => sum + (file.size || 0), 0),
      0,
    )
    const limits = planOf(user).limits
    return {
      cards: cards.length,
      scans,
      vaults: vaults.length,
      files: vaults.reduce((total, vault) => total + (vault.files || []).length, 0),
      usedBytes,
      quotaBytes: limits.storageMb * 1024 * 1024,
      cardsLimit: limits.cards,
      vaultsLimit: limits.vaults,
      canCreateCard: cards.length < limits.cards,
      canCreateVault: vaults.length < limits.vaults,
    }
  }, [cards, vaults, user])

  const value = useMemo(() => ({ cards, vaults, stats, loading, refresh }), [cards, vaults, stats, loading, refresh])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData doit être utilisé dans DataProvider')
  return context
}
