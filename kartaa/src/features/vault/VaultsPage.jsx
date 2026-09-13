import { Link } from 'react-router-dom'
import { Button, EmptyState, Panel } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import VaultTile from './VaultTile'
import { useData } from '../../state/DataContext'
import { formatBytes } from '../../lib/format'

export default function VaultsPage() {
  const { vaults, stats } = useData()
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Mes Coffres Sécurité</h1>
          <p className="mt-1 text-sm text-ink-500">
            {formatBytes(stats.usedBytes)} utilisés sur {formatBytes(stats.quotaBytes)}
          </p>
        </div>
        {stats.canCreateVault ? (
          <Button as={Link} to="/app/coffres/nouveau" variant="dark" icon="plus">
            Créer un Coffre
          </Button>
        ) : (
          <Button as={Link} to="/app/profil" variant="outline" icon="crown">
            Augmenter la limite
          </Button>
        )}
      </header>

      {vaults.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {vaults.map((vault) => (
            <VaultTile key={vault.id} vault={vault} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="vault"
          title="Votre premier coffre"
          description="Photos de famille, diplômes, certificats, archives : rassemblez-les dans un espace chiffré, ouvert par mot de passe ou empreinte."
          action={
            <Button as={Link} to="/app/coffres/nouveau" variant="dark" icon="plus">
              Créer un Coffre
            </Button>
          }
        />
      )}

      <Panel className="bg-ink-50/60">
        <div className="flex gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-brand-600 shadow-soft">
            <Icon name="shieldCheck" size={21} />
          </span>
          <div className="text-sm leading-relaxed text-ink-600">
            <p className="font-display font-bold text-ink-900">Comment vos fichiers sont protégés</p>
            <p className="mt-1.5">
              Chaque coffre possède une clé de chiffrement propre, elle-même protégée par votre mot de passe. Les
              fichiers sont chiffrés <strong>avant</strong> d'être enregistrés, et ne sont déchiffrés qu'en mémoire,
              après authentification. Le QR Code d'un coffre n'ouvre que l'écran de déverrouillage.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  )
}
