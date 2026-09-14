import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Panel, Spinner } from './ui'

/**
 * Écran affiché quand des jetons valides attendent dans le navigateur mais que le
 * serveur d'authentification n'a pas encore répondu.
 *
 * C'est le cas d'un réseau lent ou coupé au retour sur le site. Renvoyer vers
 * l'écran de connexion serait un mensonge — la session existe toujours — et
 * obligerait à ressaisir un mot de passe pour rien.
 *
 * Les premières secondes ne montrent qu'une attente : un renouvellement de jeton
 * réussi tient souvent en moins d'une seconde, et annoncer une panne à ce
 * moment-là inquiéterait pour rien. L'explication et le bouton n'arrivent que si
 * l'attente dure.
 */
export default function Reconnecting({ delaiAvantExplication = 4000 }) {
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
              Vous êtes toujours connecté : c'est le réseau qui manque. Vérifiez votre connexion,
              la reprise est automatique.
            </p>
            <Button full className="mt-5" icon="refresh" onClick={() => window.location.reload()}>
              Réessayer maintenant
            </Button>
            <Link to="/connexion" className="mt-3 block text-xs font-semibold text-ink-400 hover:text-ink-600">
              Se connecter avec un autre compte
            </Link>
          </>
        )}
      </Panel>
    </div>
  )
}
