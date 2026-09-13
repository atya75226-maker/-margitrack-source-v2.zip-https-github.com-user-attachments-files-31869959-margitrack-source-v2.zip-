import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import { formatBytes, formatDate } from '../../lib/format'
import { usedBytesOf } from '../../lib/vaultService'

export default function VaultTile({ vault }) {
  const files = vault.files?.length || 0
  const biometric = vault.protection?.includes('biometric')
  return (
    <Link
      to={`/app/coffres/${vault.id}`}
      className="group relative flex items-center gap-4 overflow-hidden rounded-3xl border border-ink-100 bg-ink-950 p-5 text-white shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift"
    >
      <span className="mesh absolute inset-0 opacity-50 transition-opacity group-hover:opacity-70" />
      <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold-400 text-ink-900">
        <Icon name="lock" size={22} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block truncate font-display text-base font-bold">{vault.name}</span>
        <span className="mt-0.5 block truncate text-xs text-white/55">
          {files} fichier{files > 1 ? 's' : ''} • {formatBytes(usedBytesOf(vault))} • créé le {formatDate(vault.createdAt)}
        </span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="dark" className="border border-white/15 bg-white/10 text-white" icon="key">
            Mot de passe
          </Badge>
          {biometric && (
            <Badge tone="dark" className="border border-white/15 bg-white/10 text-white" icon="fingerprint">
              Biométrie
            </Badge>
          )}
        </span>
      </span>
      <Icon name="chevronRight" size={18} className="relative shrink-0 text-white/40" />
    </Link>
  )
}
