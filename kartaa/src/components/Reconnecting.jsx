import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Panel, Spinner } from './ui'
import { useAuth } from '../state/AuthContext'

/**
 * Écran affiché quand des jetons valides attendent sur l'appareil mais que le
 * serveur d'authentification n'a pas encore répondu.
 *
 * Deux précautions y tiennent lieu de règle :
 *
 *  - ne rien proposer pendant les premières secondes. Un renouvellement de
 *    jeton réussi tient souvent en moins d'une seconde, et annoncer une panne
 *    à ce moment-là inquiète pour rien.
 *  - ne jamais recharger la page pour réessayer. Le serveur remplace le jeton
 *    de rafraîchissement à chaque renouvellement ; recharger pendant l'appel
 *    fait perdre le jeton qu'il vient d'émettre, et cette fois la déconnexion
 *    est définitive. Le bouton relance donc la reprise sur place.
 */
export default function Reconnecting({ delaiAvantExplication = 12000 }) {
  const { retryAuth } = useAuth()
  const [longue, setLongue] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLongue(true), delaiAvantExplication)
    return () => clearTimeout(t)
  }, [delaiAvantExplication])

  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 px-5">
      <Panel className="max-w-sm text-center">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Spinner size={24} />
        </span>
        <p className="font-display text-lg font-bold text-ink-900">Reconnexion…</p>
        {longue && (
          <>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
              Vous êtes toujours connecté : c'est le réseau qui manque. La reprise est automatique —
              évitez de recharger la page, cela interrompt la reconnexion en cours.
            </p>
            <Button full className="mt-5" icon="refresh" onClick={retryAuth}>
              Réessayer maintenant
            </Button>
            <Link to="/diagnostic" className="mt-3 block text-xs font-semibold text-ink-400 hover:text-ink-600">
              Diagnostic de connexion
            </Link>
          </>
        )}
      </Panel>
    </div>
  )
}
