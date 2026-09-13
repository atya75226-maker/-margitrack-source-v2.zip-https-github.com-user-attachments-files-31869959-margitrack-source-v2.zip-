import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, EmptyState, Panel, Progress, SectionTitle } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import ScanChart from './ScanChart'
import StatTile from '../dashboard/StatTile'
import { useData } from '../../state/DataContext'
import { useAuth } from '../../state/AuthContext'
import { can, planOf } from '../../config/app.config'
import { formatBytes, formatNumber } from '../../lib/format'

const DAYS = 14

export default function StatsPage() {
  const { cards, vaults, stats } = useData()
  const { user } = useAuth()
  const detailed = can(user, 'advancedStats')

  const series = useMemo(() => {
    const buckets = new Map()
    for (let index = DAYS - 1; index >= 0; index -= 1) {
      const date = new Date()
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - index)
      buckets.set(date.toISOString().slice(0, 10), 0)
    }
    cards.forEach((card) => {
      ;(card.scanLog || []).forEach((entry) => {
        const key = entry.at.slice(0, 10)
        if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1)
      })
    })
    return Array.from(buckets.entries()).map(([key, value]) => {
      const date = new Date(key)
      return {
        label: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date),
        full: new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date),
        value,
      }
    })
  }, [cards])

  const ranked = useMemo(() => [...cards].sort((a, b) => (b.scans || 0) - (a.scans || 0)), [cards])
  const totalScans = stats.scans
  const last7 = series.slice(-7).reduce((total, point) => total + point.value, 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Statistiques</h1>
          <p className="mt-1 text-sm text-ink-500">Ce que vos cartes et vos coffres font réellement.</p>
        </div>
        {!detailed && <Badge tone="gold" icon="crown">Détail complet en Premium</Badge>}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile icon="qr" label="Scans au total" value={formatNumber(totalScans)} tone="brand" />
        <StatTile icon="clock" label="7 derniers jours" value={formatNumber(last7)} tone="emerald" />
        <StatTile icon="card" label="Cartes actives" value={formatNumber(stats.cards)} tone="ink" />
        <StatTile
          icon="vault"
          label="Espace utilisé"
          value={formatBytes(stats.usedBytes)}
          tone="gold"
          progress={stats.quotaBytes ? (stats.usedBytes / stats.quotaBytes) * 100 : 0}
          sub={`sur ${formatBytes(stats.quotaBytes)}`}
        />
      </div>

      <Panel>
        <SectionTitle icon="chart" title="Scans par jour" subtitle={`Sur les ${DAYS} derniers jours, toutes cartes confondues.`} />
        {cards.length ? (
          <ScanChart data={series} />
        ) : (
          <EmptyState icon="qr" title="Pas encore de données" description="Créez une carte et partagez son QR Code pour voir les scans arriver ici." className="!py-8" />
        )}
      </Panel>

      <Panel>
        <SectionTitle icon="card" title="Par carte" subtitle="Classement par nombre de scans." />
        {ranked.length ? (
          <ul className="divide-y divide-ink-100">
            {ranked.map((card) => {
              const share = totalScans ? ((card.scans || 0) / totalScans) * 100 : 0
              return (
                <li key={card.id} className="py-3.5">
                  <Link to={`/app/cartes/${card.id}`} className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                      <Icon name="card" size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink-900">
                        {[card.profile?.firstName, card.profile?.lastName].filter(Boolean).join(' ') || card.slug}
                      </span>
                      <span className="block truncate text-xs text-ink-400">/{card.slug}</span>
                      <Progress value={share} className="mt-2" />
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-display text-lg font-extrabold text-ink-900">{formatNumber(card.scans || 0)}</span>
                      <span className="block text-[0.68rem] text-ink-400">scans</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="hint">Aucune carte pour l'instant.</p>
        )}
      </Panel>

      <Panel>
        <SectionTitle icon="vault" title="Coffres" subtitle="Fichiers stockés et dernier accès." />
        {vaults.length ? (
          <ul className="divide-y divide-ink-100">
            {vaults.map((vault) => (
              <li key={vault.id} className="flex items-center gap-3 py-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-900 text-gold-400">
                  <Icon name="lock" size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink-900">{vault.name}</span>
                  <span className="block text-xs text-ink-400">
                    {(vault.files || []).length} fichier{(vault.files || []).length > 1 ? 's' : ''} •{' '}
                    {formatBytes((vault.files || []).reduce((total, file) => total + (file.size || 0), 0))}
                  </span>
                </span>
                <Button as={Link} to={`/app/coffres/${vault.id}`} size="sm" variant="outline">
                  Ouvrir
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">Aucun coffre pour l'instant.</p>
        )}
      </Panel>

      {!detailed && (
        <Panel className="border-gold-200 bg-gold-50/50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-3">
              <Icon name="crown" size={20} className="mt-0.5 shrink-0 text-gold-600" />
              <div>
                <p className="font-display text-sm font-bold text-ink-900">Statistiques avancées</p>
                <p className="hint mt-0.5">
                  Provenance des scans, appareils, heures de pointe et export : inclus dans l'offre {planOf(user).id === 'free' ? 'Premium' : 'VIP'}.
                </p>
              </div>
            </div>
            <Button as={Link} to="/app/profil" variant="gold" size="sm">
              Voir les offres
            </Button>
          </div>
        </Panel>
      )}
    </div>
  )
}
