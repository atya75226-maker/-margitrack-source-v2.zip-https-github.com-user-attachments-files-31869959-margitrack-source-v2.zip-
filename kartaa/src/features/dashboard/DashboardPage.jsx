import { Link } from 'react-router-dom'
import { Button, EmptyState, SectionTitle, Badge } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import StatTile from './StatTile'
import CardMiniature from '../cards/CardMiniature'
import { useAuth } from '../../state/AuthContext'
import { useData } from '../../state/DataContext'
import { isPro } from '../../config/app.config'
import { useTranslation } from '../../i18n'
import { formatNumber } from '../../lib/format'

export default function DashboardPage() {
  const { user } = useAuth()
  const { cards, stats } = useData()
  const { t } = useTranslation()
  const pro = isPro(user)

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink-400">Bonjour {user?.firstName},</p>
          <h1 className="font-display text-2xl font-extrabold text-ink-900 sm:text-3xl">Votre tableau de bord</h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-500">
            Créez votre carte, partagez votre QR Code et permettez à vos clients de vous retrouver en un seul geste.
          </p>
        </div>
        <Badge tone={pro ? 'gold' : 'neutral'} icon={pro ? 'crown' : null}>
          {pro ? t('plan.pro') : t('plan.free')}
        </Badge>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile icon="card" label="Cartes créées" value={formatNumber(stats.cards)} sub={`Limite : ${stats.cardsLimit === Infinity ? 'illimitée' : stats.cardsLimit}`} />
        <StatTile icon="qr" label="Scans de QR Code" value={formatNumber(stats.scans)} tone="emerald" sub="Toutes cartes confondues" />
      </div>

      <section>
        <SectionTitle
          icon="card"
          title="Mes cartes"
          subtitle="Vos cartes de visite numériques et leurs QR Codes."
          action={
            stats.canCreateCard ? (
              <Button as={Link} to="/app/cartes/nouvelle" size="sm" icon="plus">
                Créer une carte
              </Button>
            ) : (
              <Button as={Link} to="/app/abonnement" size="sm" variant="outline" icon="crown">
                Passer à Pro
              </Button>
            )
          }
        />
        {cards.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {cards.slice(0, 4).map((card) => (
              <CardMiniature key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="card"
            title="Aucune carte pour l'instant"
            description="Créez votre première carte de visite numérique : nom, photo, coordonnées, réseaux sociaux et QR Code."
            action={
              <Button as={Link} to="/app/cartes/nouvelle" icon="plus">
                Créer une carte
              </Button>
            }
          />
        )}
        {cards.length > 4 && (
          <Link to="/app/cartes" className="mt-4 flex items-center justify-center gap-1.5 text-sm font-bold text-brand-600">
            Voir mes {cards.length} cartes <Icon name="arrowRight" size={16} />
          </Link>
        )}
      </section>

    </div>
  )
}
