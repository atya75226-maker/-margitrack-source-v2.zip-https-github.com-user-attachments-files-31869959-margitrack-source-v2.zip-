import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { repo } from '../lib/storage'
import { planOf } from '../config/app.config'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { user } = useAuth()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setCards([])
      setLoading(false)
      return
    }
    setCards(await repo.cards.listByUser(user.id))
    setLoading(false)
  }, [user])

  useEffect(() => {
    setLoading(true)
    refresh()
    return repo.subscribe(refresh)
  }, [refresh])

  const stats = useMemo(() => {
    const scans = cards.reduce((total, card) => total + (card.scans || 0), 0)
    const limits = planOf(user).limits
    return {
      cards: cards.length,
      scans,
      cardsLimit: limits.cards,
      canCreateCard: cards.length < limits.cards,
    }
  }, [cards, user])

  const value = useMemo(() => ({ cards, stats, loading, refresh }), [cards, stats, loading, refresh])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData doit être utilisé dans DataProvider')
  return context
}
