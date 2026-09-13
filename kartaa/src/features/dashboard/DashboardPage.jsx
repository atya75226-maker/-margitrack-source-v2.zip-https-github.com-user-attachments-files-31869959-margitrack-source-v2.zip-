import { Link } from 'react-router-dom'
import { Button, EmptyState, SectionTitle, Badge } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import StatTile from './StatTile'
import CardMiniature from '../cards/CardMiniature'
import VaultTile from '../vault/VaultTile'
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
  const storagePercent = stats.quotaBytes ? (stats.usedBytes / stats.quotaBytes) * 100 : 0

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink-400">Bonjour {user?.firstName},</p>
          <h1 className="font-display text-2xl font-extrabold text-ink-900 sm:text-3xl">Votre tableau de bord</h1>
        </div>
        <Badge tone={pro ? 'gold' : 'neutral'} icon={pro ? 'crown' : null}>
          {pro ? t('plan.pro') : t('plan.free')}
        </Badge>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile icon="card" label="Cartes créées" value={formatNumber(stats.cards)} sub={`Limite : ${stats.cardsLimit === Infinity ? 'illimitée' : stats.cardsLimit}`} />
        <StatTile icon="qr" label="Scans de QR Code" value={formatNumber(stats.scans)} tone="emerald" sub="Toutes cartes confondues" />
        <StatTile icon="vault" label="Coffres Sécurité" value={formatNumber(stats.vaults)} tone="ink" sub={`${formatNumber(stats.files)} fichier${stats.files > 1 ? 's' : ''}`} />
        <StatTile
          icon="upload"
          label="Espace utilisé"
          value={formatBytes(stats.usedBytes)}
          tone="gold"
          progress={storagePercent}
          sub={`sur ${formatBytes(stats.quotaBytes)}`}
        />
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

      <section>
        <SectionTitle
          icon="vault"
          title="Mes Coffres Sécurité"
          subtitle="Vos photos, vidéos et documents protégés."
          action={
            stats.canCreateVault ? (
              <Button as={Link} to="/app/coffres/nouveau" size="sm" variant="dark" icon="plus">
                Créer un Coffre
              </Button>
            ) : (
              <Button as={Link} to="/app/abonnement" size="sm" variant="outline" icon="crown">
                Passer à Pro
              </Button>
            )
          }
        />
        {vaults.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {vaults.slice(0, 4).map((vault) => (
              <VaultTile key={vault.id} vault={vault} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="vault"
            title="Aucun coffre pour l'instant"
            description="Créez un espace privé pour vos souvenirs, diplômes et documents importants — protégé par mot de passe ou biométrie."
            action={
              <Button as={Link} to="/app/coffres/nouveau" variant="dark" icon="plus">
                Créer un Coffre
              </Button>
            }
          />
        )}
      </section>
    </div>
  )
}
