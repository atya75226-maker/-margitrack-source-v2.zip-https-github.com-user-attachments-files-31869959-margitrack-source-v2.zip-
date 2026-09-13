import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Panel, Spinner } from '../../components/ui'
import { Icon, Logo } from '../../components/ui/Icons'
import VaultUnlock from './VaultUnlock'
import VaultBrowser from './VaultBrowser'
import { repo, revokeAllUrls } from '../../lib/storage'
import { useAuth } from '../../state/AuthContext'
import * as vaultSession from '../../lib/vaultSession'

/**
 * Page atteinte en scannant le QR Code d'un coffre.
 * Elle n'expose rien d'autre que le nom du coffre tant que l'authentification n'a pas eu lieu.
 */
export default function VaultAccessPage() {
  const { vaultId } = useParams()
  const { user } = useAuth()
  const [vault, setVault] = useState(null)
  const [vaultKey, setVaultKey] = useState(() => vaultSession.getKey(vaultId))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    repo.vaults.get(vaultId).then((found) => {
      setVault(found)
      setLoading(false)
    })
  }, [vaultId])

  useEffect(() => () => revokeAllUrls(), [])

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-brand-600">
        <Spinner size={28} />
      </div>
    )
  }

  if (!vault) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50 px-5">
        <Panel className="max-w-sm text-center">
          <Icon name="alert" size={28} className="mx-auto mb-3 text-ink-300" />
          <p className="font-display font-bold text-ink-900">Coffre introuvable</p>
          <p className="mt-1.5 text-sm text-ink-500">
            Ce QR Code ne correspond à aucun coffre sur cet appareil. Le coffre a peut-être été supprimé.
          </p>
          <Button as={Link} to="/" variant="outline" className="mt-5">
            Retour à l'accueil
          </Button>
        </Panel>
      </div>
    )
  }

  const isOwner = user?.id === vault.userId

  if (!vaultKey) {
    return (
      <div className="min-h-screen bg-ink-50 px-5 py-10">
        <VaultUnlock
          vault={vault}
          standalone
          onUnlocked={(key, fresh) => {
            vaultSession.unlock(vault.id, key)
            setVaultKey(key)
            if (fresh) setVault(fresh)
          }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-3.5">
          <Logo size={30} />
          <div className="flex items-center gap-2">
            {isOwner && (
              <Button as={Link} to={`/app/coffres/${vault.id}`} size="sm" variant="outline" icon="settings">
                Gérer
              </Button>
            )}
            <Button
              size="sm"
              variant="dark"
              icon="lock"
              onClick={() => {
                vaultSession.lock(vault.id)
                setVaultKey(null)
                revokeAllUrls()
              }}
            >
              Verrouiller
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-5 py-6">
        <div className="mb-5">
          <h1 className="font-display text-xl font-extrabold text-ink-900">{vault.name}</h1>
          <p className="flex items-center gap-1.5 text-sm text-emerald-600">
            <Icon name="unlock" size={14} /> Accès autorisé
          </p>
        </div>
        <VaultBrowser vault={vault} vaultKey={vaultKey} onChange={setVault} readOnly={!isOwner} />
      </main>
    </div>
  )
}
