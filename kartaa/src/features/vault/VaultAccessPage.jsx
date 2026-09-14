import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Panel, Spinner } from '../../components/ui'
import { Icon, Logo } from '../../components/ui/Icons'
import VaultUnlock from './VaultUnlock'
import VaultBrowser from './VaultBrowser'
import { repo } from '../../lib/storage'
import { useAuth } from '../../state/AuthContext'
import * as vaultSession from '../../lib/vaultSession'
import * as vaultPublic from '../../lib/vaultPublic'

/**
 * Page atteinte en scannant le QR Code d'un coffre.
 *
 * Aucun compte n'est demandé : le QR Code ne transporte qu'un identifiant, et
 * c'est le mot de passe du coffre — et lui seul — qui ouvre le contenu. Le
 * compte utilisateur sert à gérer ses coffres ; il n'est pas une condition pour
 * en ouvrir un dont on connaît le mot de passe.
 *
 * Avant déverrouillage, la page ne montre rien : ni le nom du coffre, ni le
 * nombre de fichiers. Le serveur lui-même ne livre que les sels nécessaires au
 * calcul du vérificateur.
 */
export default function VaultAccessPage() {
  const { vaultId } = useParams()
  const { user } = useAuth()
  const [vault, setVault] = useState(null)
  const [vaultKey, setVaultKey] = useState(() => vaultSession.getKey(vaultId))
  const [token, setToken] = useState(() => vaultSession.getToken(vaultId))
  const [loading, setLoading] = useState(true)
  // « introuvable » et « injoignable » ne se confondent pas : annoncer un coffre
  // disparu parce que le réseau a coupé ferait paniquer pour rien.
  const [probleme, setProbleme] = useState(null)

  // L'état du coffre se lit sans compte : vault_intro ne renvoie que les sels,
  // le nombre de tentatives et l'éventuel verrou.
  const [essai, setEssai] = useState(0)

  useEffect(() => {
    let vivant = true
    setLoading(true)
    vaultPublic
      .intro(vaultId)
      .then((found) => {
        if (!vivant) return
        if (found) setVault(found)
        else setProbleme('introuvable')
      })
      .catch(() => vivant && setProbleme('reseau'))
      .finally(() => vivant && setLoading(false))
    return () => {
      vivant = false
    }
  }, [vaultId, essai])

  /** Après ouverture, le contenu arrive contre le jeton de session. */
  const chargerContenu = useCallback(
    async (jeton, proprietaire) => {
      const contenu = proprietaire ? await repo.vaults.get(vaultId) : await vaultPublic.contentByToken(jeton)
      if (contenu) setVault((precedent) => ({ ...precedent, ...contenu }))
    },
    [vaultId],
  )

  // Coffre déjà déverrouillé pendant cette session : on récupère son contenu.
  useEffect(() => {
    if (vaultKey && vault && !vault.name) chargerContenu(token, vault.isOwner)
  }, [vaultKey, vault, token, chargerContenu])

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50 text-brand-600">
        <Spinner size={28} />
      </div>
    )
  }

  if (probleme === 'reseau') {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50 px-5">
        <Panel className="max-w-sm text-center">
          <Icon name="alert" size={28} className="mx-auto mb-3 text-gold-500" />
          <p className="font-display font-bold text-ink-900">Coffre pas joignable</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
            Le coffre existe peut-être très bien : c'est la connexion qui manque. Vérifiez votre
            réseau, puis réessayez.
          </p>
          <Button full className="mt-5" icon="refresh" onClick={() => { setProbleme(null); setEssai((n) => n + 1) }}>
            Réessayer
          </Button>
        </Panel>
      </div>
    )
  }

  if (probleme || !vault) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50 px-5">
        <Panel className="max-w-sm text-center">
          <Icon name="alert" size={28} className="mx-auto mb-3 text-ink-300" />
          <p className="font-display font-bold text-ink-900">Coffre introuvable</p>
          <p className="mt-1.5 text-sm text-ink-500">
            Ce QR Code ne correspond à aucun coffre. Il a peut-être été supprimé.
          </p>
          <Button as={Link} to="/" variant="outline" className="mt-5">
            Découvrir Kartaa
          </Button>
        </Panel>
      </div>
    )
  }

  if (!vaultKey) {
    return (
      <div className="min-h-screen bg-ink-50 px-5 py-10">
        <VaultUnlock
          vault={vault}
          standalone
          publicAccess={!vault.isOwner}
          onUnlocked={async ({ key, token: jeton }, fresh) => {
            vaultSession.unlock(vault.id, key, jeton)
            setVaultKey(key)
            setToken(jeton)
            if (fresh) setVault((precedent) => ({ ...precedent, ...fresh }))
            await chargerContenu(jeton, vault.isOwner)
          }}
        />
      </div>
    )
  }

  const isOwner = !!user && user.id === vault.userId

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
                vaultPublic.closeSession(token)
                vaultSession.lock(vault.id)
                setVaultKey(null)
                setToken(null)
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
        <VaultBrowser
          vault={vault}
          vaultKey={vaultKey}
          token={token}
          onChange={setVault}
          readOnly={!isOwner}
        />
      </main>
    </div>
  )
}
