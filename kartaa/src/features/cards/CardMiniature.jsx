import { Link } from 'react-router-dom'
import { CardArtwork, CardScaler } from '../../components/card/CardArtwork'
import { useCardAssets } from '../../hooks/useCardAssets'
import { Badge } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import { formatNumber } from '../../lib/format'

const TEMPLATE_LABEL = { standard: 'Standard', premium: 'Premium', vip: 'VIP' }

/** Vignette de carte utilisée sur le tableau de bord et la liste des cartes. */
export default function CardMiniature({ card, to }) {
  const { qr } = useCardAssets(card)
  return (
    <Link
      to={to || `/app/cartes/${card.id}`}
      className="group block overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="overflow-hidden bg-ink-100">
        <CardScaler>
          <CardArtwork card={card} side="back" qr={qr} />
        </CardScaler>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-ink-900">
            {[card.profile?.firstName, card.profile?.lastName].filter(Boolean).join(' ') || 'Sans nom'}
          </p>
          <p className="truncate text-xs text-ink-400">/{card.slug}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={card.template === 'vip' ? 'dark' : card.template === 'premium' ? 'brand' : 'neutral'}>
            {TEMPLATE_LABEL[card.template] || 'Standard'}
          </Badge>
          <span className="flex items-center gap-1 text-xs font-bold text-ink-500">
            <Icon name="eye" size={14} />
            {formatNumber(card.scans || 0)}
          </span>
        </div>
      </div>
    </Link>
  )
}
