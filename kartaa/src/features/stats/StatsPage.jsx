import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, EmptyState, Panel, Progress, SectionTitle } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import ScanChart from './ScanChart'
import StatTile from '../dashboard/StatTile'
import { useData } from '../../state/DataContext'
import { repo } from '../../lib/storage'
import { useAuth } from '../../state/AuthContext'
import { can, PRO_CAPABILITIES } from '../../config/app.config'
import { formatNumber } from '../../lib/format'

const DAYS = 14
const DAYS_INTERACTIONS = 30

/**
 * Ce qu'une carte déclenche vraiment. L'ordre suit l'intérêt : être appelé
 * compte davantage que d'être regardé.
 */
const INTERACTIONS = [
  { kind: 'call', label: 'Appels', icon: 'phone', tone: 'brand' },
  { kind: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp', tone: 'emerald' },
  { kind: 'email', label: 'E-mails', icon: 'mail', tone: 'ink' },
  { kind: 'social', label: 'Réseaux', icon: 'share', tone: 'gold' },
  { kind: 'website', label: 'Sites web', icon: 'globe', tone: 'ink' },
  { kind: 'vcard', label: 'Ajouts aux contacts', icon: 'download', tone: 'brand' },
]

export default function StatsPage() {
  const { cards, stats } = useData()
  const { user } = useAuth()
  const detailed = can(user, 'advancedStats')

  const [history, setHistory] = useState([])
  const [interactions, setInteractions] = useState(null)

  useEffect(() => {
    let cancelled = false
    repo.cards.scanHistory(DAYS).then((rows) => {
      if (!cancelled) setHistory(rows)
    })
    return () => {
      cancelled = true
    }
  }, [cards.length])

  // Le détail des interactions suit la même règle que le reste des statistiques
  // avancées : inutile de le charger pour un compte qui ne peut pas le voir.
  useEffect(() => {
    if (!detailed) return undefined
    let cancelled = false
    repo.cards.myEventCounts(DAYS_INTERACTIONS).then((counts) => {
      // Le serveur applique la même règle que l'écran : il répond
      // « verrouillé » plutôt que des chiffres si l'offre ne les couvre pas.
      if (!cancelled) setInteractions(counts?.locked ? null : counts)
    })
    return () => {
      cancelled = true
    }
  }, [detailed, cards.length])

  const series = useMemo(() => {
    const buckets = new Map()
    for (let index = DAYS - 1; index >= 0; index -= 1) {
      const date = new Date()
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - index)
      buckets.set(date.toISOString().slice(0, 10), 0)
    }
    history.forEach((entry) => {
      const key = entry.at.slice(0, 10)
      if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1)
    })
    return Array.from(buckets.entries()).map(([key, value]) => {
      const date = new Date(key)
      return {
        label: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date),
        full: new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date),
        value,
      }
    })
  }, [history])

  const ranked = useMemo(() => [...cards].sort((a, b) => (b.scans || 0) - (a.scans || 0)), [cards])
  const totalScans = stats.scans
  const last7 = series.slice(-7).reduce((total, point) => total + point.value, 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Statistiques</h1>
          <p className="mt-1 text-sm text-ink-500">Ce que vos cartes font réellement.</p>
        </div>
        {!detailed && <Badge tone="gold" icon="crown">Détail complet avec Pro</Badge>}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatTile icon="qr" label="Scans au total" value={formatNumber(totalScans)} tone="brand" />
        <StatTile icon="clock" label="7 derniers jours" value={formatNumber(last7)} tone="emerald" />
        <StatTile icon="card" label="Cartes actives" value={formatNumber(stats.cards)} tone="ink" />
      </div>

      <Panel>
        <SectionTitle icon="chart" title="Scans par jour" subtitle={`Sur les ${DAYS} derniers jours, toutes cartes confondues.`} />
        {cards.length ? (
          <ScanChart data={series} />
        ) : (
          <EmptyState icon="qr" title="Pas encore de données" description="Créez une carte et partagez son QR Code pour voir les scans arriver ici." className="!py-8" />
        )}
      </Panel>

      {detailed && (
        <Panel>
          <SectionTitle
            icon="sparkles"
            title="Ce que vos cartes déclenchent"
            subtitle={`Actions sur vos mini-sites, sur les ${DAYS_INTERACTIONS} derniers jours.`}
          />
          {interactions && Object.keys(interactions).length ? (
            <>
              <p className="mb-3 text-sm text-ink-500">
                <strong className="text-ink-900">{formatNumber(interactions.view || 0)}</strong> ouverture
                {(interactions.view || 0) > 1 ? 's' : ''} de mini-site sur la période.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {INTERACTIONS.map((item) => (
                  <StatTile
                    key={item.kind}
                    icon={item.icon}
                    label={item.label}
                    value={formatNumber(interactions[item.kind] || 0)}
                    tone={item.tone}
                  />
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon="sparkles"
              title="Aucune action pour l'instant"
              description="Dès qu'une personne appellera, écrira ou ouvrira un de vos réseaux depuis votre mini-site, le compte apparaîtra ici."
              className="!py-8"
            />
          )}
        </Panel>
      )}

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


      {!detailed && (
        <Panel className="border-gold-200 bg-gold-50/50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-3">
              <Icon name="lock" size={20} className="mt-0.5 shrink-0 text-gold-600" />
              <div>
                <p className="font-display text-sm font-bold text-ink-900">
                  {PRO_CAPABILITIES.advancedStats.label}
                </p>
                <p className="hint mt-0.5">{PRO_CAPABILITIES.advancedStats.value}</p>
              </div>
            </div>
            <Button as={Link} to="/app/abonnement" variant="gold" size="sm">
              Voir Pro
            </Button>
          </div>
        </Panel>
      )}
    </div>
  )
}
