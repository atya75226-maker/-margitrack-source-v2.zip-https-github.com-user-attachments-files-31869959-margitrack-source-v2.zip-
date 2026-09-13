import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Panel, Spinner } from '../../components/ui'
import { Icon, Logo } from '../../components/ui/Icons'
import { useAuth } from '../../state/AuthContext'

/**
 * Retour du fournisseur d'identité (Google).
 * Le client Supabase récupère la session dans l'URL ; il ne reste qu'à attendre
 * qu'elle soit chargée, puis à emmener la personne là où elle allait.
 */
export default function AuthCallbackPage() {
  const { ready, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [tropLong, setTropLong] = useState(false)

  const destination = params.get('next') || '/app'

  // Google peut signaler un refus dans la requête ou dans le fragment d'URL.
  const fragment = new URLSearchParams((window.location.hash || '').replace(/^#/, ''))
  const erreur = params.get('error_description') || params.get('error')
    || fragment.get('error_description') || fragment.get('error')

  useEffect(() => {
    if (erreur || !ready) return undefined
    if (isAuthenticated) {
      navigate(destination, { replace: true })
      return undefined
    }
    // Session absente alors que le chargement est terminé : on laisse une porte de sortie.
    const minuteur = setTimeout(() => setTropLong(true), 2500)
    return () => clearTimeout(minuteur)
  }, [erreur, ready, isAuthenticated, destination, navigate])

  if (erreur || tropLong) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50 px-5">
        <Panel className="max-w-sm text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
            <Icon name="alert" size={26} />
          </span>
          <p className="font-display text-lg font-bold text-ink-900">Connexion interrompue</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
            {erreur ? decodeURIComponent(String(erreur).replace(/\+/g, ' ')) : "La session n'a pas pu être ouverte."}
          </p>
          <Button as={Link} to="/connexion" full className="mt-5">
            Revenir à la connexion
          </Button>
        </Panel>
      </div>
    )
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 px-5">
      <div className="text-center">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <Spinner size={26} className="mx-auto text-brand-600" />
        <p className="mt-4 text-sm font-semibold text-ink-500">Connexion en cours…</p>
      </div>
    </div>
  )
}
