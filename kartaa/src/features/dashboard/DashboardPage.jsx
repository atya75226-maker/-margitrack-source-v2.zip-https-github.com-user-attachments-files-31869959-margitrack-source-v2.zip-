import { Link } from 'react-router-dom'
import { Button, EmptyState, SectionTitle, Badge } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import StatTile from './StatTile'
import CardMiniature from '../cards/CardMiniature'
import { useAuth } from '../../state/AuthContext'
import { useData } from '../../state/DataContext'
import { isPro } from '../../config/app.config'
import { useTranslation } from '../../i18n'
import { formatBytes, formatNumber } from '../../lib/format'

export default function DashboardPage() {
  const { user } = useAuth()
  const { cards, vaults, stats } = useData()
  const { t } = useTranslation()
  const pro = isPro(user)

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-400">Bonjour {user?.firstName},</p>
          <h1 className="mt-0.5 font-display text-2xl font-extrabold text-ink-900 sm:text-3xl">
            Votre identité professionnelle numérique
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-500">
            Créez votre carte, partagez votre QR Code et permettez à vos clients de vous retrouver en un
            seul geste.
          </p>
        </div>
        <Badge tone={pro ? 'gold' : 'neutral'} icon={pro ? 'crown' : null}>
          {pro ? t('plan.pro') : t('plan.free')}
        </Badge>
      </header>

      {/* Le geste principal d'abord, les chiffres ensuite : c'est la carte qui
          fait le produit, pas le tableau de bord. */}
      <div className="flex flex-wrap gap-3">
        {stats.canCreateCard ? (
          <Button as={Link} to="/app/cartes/nouvelle" size="lg" icon="plus">
            Créer ma carte
          </Button>
        ) : (
          <Button as={Link} to={`/app/cartes/${cards[0]?.id || ''}`} size="lg" icon="card">
            Voir ma carte
          </Button>
        )}
        {!!cards.length && stats.canCreateCard && (
          <Button as={Link} to={`/app/cartes/${cards[0].id}`} size="lg" variant="outline" icon="card">
            Voir ma carte
          </Button>
        )}
        <Button as={Link} to="/app/scanner" size="lg" variant="outline" icon="scan">
          Scanner un QR
        </Button>
      </div>

      {/* Deux chiffres, tous deux réels. Une troisième tuile « ouvertures du
          mini-site » afficherait aujourd'hui la même valeur que les scans : le
          détail des ouvertures existe en base, mais il n'est pas remonté ici. */}
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

      {/* Fonctionnalité secondaire : une seule ligne, sans vignettes, pour ne pas
          concurrencer les cartes sur l'écran d'accueil. */}
      <Link
        to="/app/coffres"
        className="flex items-center gap-4 rounded-3xl border border-ink-100 bg-white p-4 shadow-soft transition-colors hover:border-brand-200"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink-900 text-white">
          <Icon name="vault" size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-bold text-ink-900">Coffre Sécurité</span>
          <span className="mt-0.5 block text-xs text-ink-500">
            {vaults.length
              ? `${formatNumber(vaults.length)} coffre${vaults.length > 1 ? 's' : ''} • ${formatBytes(stats.usedBytes)} sur ${formatBytes(stats.quotaBytes)}`
              : 'Vos documents privés, chiffrés sur votre appareil.'}
          </span>
        </span>
        <Icon name="chevronRight" size={18} className="shrink-0 text-ink-300" />
      </Link>

    </div>
  )
}
