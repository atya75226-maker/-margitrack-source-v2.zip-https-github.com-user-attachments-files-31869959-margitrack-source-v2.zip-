import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { operationsEnAttente, surAttenteChangee, synchroniser } from '../lib/offline/donnees'

/**
 * État du réseau et de la file d'attente.
 *
 * Quatre états, et rien d'inventé : ce qui est affiché reflète ce qui est
 * réellement arrivé — `navigator.onLine` pour la connexion, le contenu réel de
 * la file pour le reste.
 *
 *   hors-ligne     le navigateur annonce qu'il n'y a pas de réseau
 *   en-attente     des modifications sont enregistrées ici, pas encore envoyées
 *   synchronisation  la file est en train d'être vidée
 *   synchronise    tout est parti
 */
const ReseauContext = createContext(null)

export function ReseauProvider({ children }) {
  const [enLigne, setEnLigne] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  const [enAttente, setEnAttente] = useState(0)
  const [conflits, setConflits] = useState(0)
  const [occupe, setOccupe] = useState(false)

  const relire = useCallback(async () => {
    const operations = await operationsEnAttente()
    setEnAttente(operations.filter((o) => o.statut === 'en-attente').length)
    setConflits(operations.filter((o) => o.statut === 'conflit' || o.statut === 'refusee').length)
  }, [])

  const vider = useCallback(async () => {
    setOccupe(true)
    try {
      await synchroniser()
    } finally {
      setOccupe(false)
      await relire()
    }
  }, [relire])

  useEffect(() => {
    relire()
    return surAttenteChangee(relire)
  }, [relire])

  useEffect(() => {
    const revenu = () => {
      setEnLigne(true)
      vider()
    }
    const parti = () => setEnLigne(false)
    window.addEventListener('online', revenu)
    window.addEventListener('offline', parti)
    // Le retour au premier plan est le meilleur moment pour réessayer : c'est
    // souvent là que le réseau est revenu sans qu'aucun évènement ne l'ait dit.
    const auRetour = () => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) vider()
    }
    document.addEventListener('visibilitychange', auRetour)
    if (navigator.onLine !== false) vider()
    return () => {
      window.removeEventListener('online', revenu)
      window.removeEventListener('offline', parti)
      document.removeEventListener('visibilitychange', auRetour)
    }
  }, [vider])

  const etat = !enLigne ? 'hors-ligne' : occupe ? 'synchronisation' : enAttente ? 'en-attente' : 'synchronise'

  const value = useMemo(
    () => ({ enLigne, etat, enAttente, conflits, synchroniserMaintenant: vider }),
    [enLigne, etat, enAttente, conflits, vider],
  )

  return <ReseauContext.Provider value={value}>{children}</ReseauContext.Provider>
}

export function useReseau() {
  const contexte = useContext(ReseauContext)
  if (!contexte) throw new Error('useReseau doit être utilisé dans ReseauProvider')
  return contexte
}
