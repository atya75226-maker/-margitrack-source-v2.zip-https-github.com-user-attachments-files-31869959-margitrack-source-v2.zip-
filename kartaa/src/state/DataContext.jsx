import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { repo } from '../lib/storage'
import { chargerCartes } from '../lib/offline/donnees'
import { planOf } from '../config/app.config'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { user } = useAuth()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  // Vrai quand les cartes affichées viennent de la copie locale : le serveur
  // n'a pas répondu. L'écran peut alors le dire au lieu de faire comme si.
  const [local, setLocal] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setCards([])
      setLocal(false)
      setLoading(false)
      return
    }
    // chargerCartes ne lève jamais : sans réseau, elle rend la copie locale.
    // Auparavant l'appel direct au serveur levait sans être rattrapé, et
    // l'application restait bloquée sur son écran de chargement.
    const { cartes, local: horsLigne } = await chargerCartes(user.id)
    setCards(cartes)
    setLocal(horsLigne)
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

  const value = useMemo(() => ({ cards, stats, loading, local, refresh }), [cards, stats, loading, local, refresh])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData doit être utilisé dans DataProvider')
  return context
}
