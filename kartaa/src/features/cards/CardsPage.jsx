import { Link } from 'react-router-dom'
import { Button, EmptyState } from '../../components/ui'
import CardMiniature from './CardMiniature'
import { useData } from '../../state/DataContext'

export default function CardsPage() {
  const { cards, stats } = useData()
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Mes cartes</h1>
          <p className="mt-1 text-sm text-ink-500">
            {cards.length} carte{cards.length > 1 ? 's' : ''} •{' '}
            {stats.cardsLimit === Infinity ? 'nombre illimité' : `limite de ${stats.cardsLimit} sur votre offre`}
          </p>
        </div>
        {stats.canCreateCard ? (
          <Button as={Link} to="/app/cartes/nouvelle" icon="plus">
            Créer une carte
          </Button>
        ) : (
          <Button as={Link} to="/app/profil" variant="outline" icon="crown">
            Augmenter la limite
          </Button>
        )}
      </header>

      {cards.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((card) => (
            <CardMiniature key={card.id} card={card} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="card"
          title="Aucune carte pour l'instant"
          description="L'assistant vous guide en cinq étapes : informations, réseaux sociaux, présentation, entreprises et design."
          action={
            <Button as={Link} to="/app/cartes/nouvelle" icon="plus">
              Créer ma première carte
            </Button>
          }
        />
      )}
    </div>
  )
}
