import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, ConfirmDialog, Field, Modal, Panel, PasswordInput, SectionTitle, Spinner, Tabs } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import VaultUnlock from './VaultUnlock'
import VaultBrowser from './VaultBrowser'
import RecoveryCodeScreen from './RecoveryCodeScreen'
import { repo } from '../../lib/storage'
import { addBiometrics, changePassword, regenerateRecoveryCode, removeBiometrics } from '../../lib/vaultService'
import { useAuth } from '../../state/AuthContext'
import { useData } from '../../state/DataContext'
import { useToast } from '../../state/ToastContext'
import { useQrCode } from '../../hooks/useCardAssets'
import { vaultUrl } from '../../lib/slug'
import { copyToClipboard, downloadUrl } from '../../lib/download'
import { formatDateTime } from '../../lib/format'
import { isPlatformAuthenticatorAvailable } from '../../lib/webauthn'
import * as vaultSession from '../../lib/vaultSession'
import { isPro } from '../../config/app.config'

const LOG_LABELS = {
  'vault.created': 'Coffre créé',
  'vault.unlock': 'Déverrouillage',
  'vault.password.reset': 'Mot de passe réinitialisé',
  'vault.password.changed': 'Mot de passe modifié',
  'vault.recovery.regenerated': 'Code de récupération renouvelé',
  'vault.biometrics.enabled': 'Biométrie activée',
  'vault.biometrics.disabled': 'Biométrie désactivée',
  'file.added': 'Fichier ajouté',
  'file.opened': 'Fichier consulté',
  'file.deleted': 'Fichier supprimé',
}

export default function VaultDetailPage() {
  const { vaultId } = useParams()
  const { user } = useAuth()
  const { stats } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const [vault, setVault] = useState(null)
  const [vaultKey, setVaultKey] = useState(() => vaultSession.getKey(vaultId))
  const [tab, setTab] = useState('files')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    repo.vaults.get(vaultId).then((found) => {
      setVault(found)
      setLoading(false)
    })
  }, [vaultId])

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-brand-600">
        <Spinner size={28} />
      </div>
    )
  }

  if (!vault) {
    return (
      <Panel className="text-center">
        <p className="font-display font-bold text-ink-900">Ce coffre est introuvable.</p>
        <Button as={Link} to="/app/coffres" className="mt-4" variant="outline">
          Retour à mes coffres
        </Button>
      </Panel>
    )
  }

  if (!vaultKey) {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-3">
          <Link to="/app/coffres" className="rounded-xl p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-900" aria-label="Retour">
            <Icon name="arrowLeft" size={20} />
          </Link>
          <h1 className="font-display text-xl font-extrabold text-ink-900">Accès au coffre</h1>
        </header>
        <VaultUnlock
          vault={vault}
          onUnlocked={({ key, token }, fresh) => {
            vaultSession.unlock(vault.id, key, token)
            setVaultKey(key)
            if (fresh) setVault(fresh)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link to="/app/coffres" className="rounded-xl p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-900" aria-label="Retour">
          <Icon name="arrowLeft" size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-extrabold text-ink-900 sm:text-2xl">{vault.name}</h1>
          <p className="flex items-center gap-1.5 text-sm text-emerald-600">
            <Icon name="unlock" size={14} /> Coffre déverrouillé
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          icon="lock"
          onClick={() => {
            vaultSession.lock(vault.id)
            setVaultKey(null)
            toast.info('Coffre verrouillé.')
          }}
        >
          Verrouiller
        </Button>
      </header>

      <Tabs
        className="max-w-md"
        tabs={[
          { id: 'files', label: 'Fichiers' },
          { id: 'qr', label: 'QR Code' },
          { id: 'security', label: 'Sécurité' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'files' && (
        <VaultBrowser
          vault={vault}
          vaultKey={vaultKey}
          onChange={setVault}
          quotaBytes={stats.quotaBytes}
          usedBytes={stats.usedBytes}
          quotaLabel={isPro(user) ? 'Pro' : 'gratuite'}
        />
      )}

      {tab === 'qr' && <VaultQrPanel vault={vault} />}

      {tab === 'security' && (
        <SecurityPanel
          vault={vault}
          vaultKey={vaultKey}
          user={user}
          onChange={setVault}
          onDeleted={() => navigate('/app/coffres', { replace: true })}
        />
      )}
    </div>
  )
}

function VaultQrPanel({ vault }) {
  const url = vaultUrl(vault.id)
  const qr = useQrCode(url)
  const toast = useToast()
  return (
    <Panel>
      <SectionTitle icon="qr" title={`QR Code — ${vault.name}`} subtitle="Il ouvre la page de déverrouillage de ce coffre." />
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        {qr ? (
          <img src={qr} alt="QR Code du coffre" className="h-44 w-44 rounded-2xl border border-ink-100 p-2" />
        ) : (
          <div className="grid h-44 w-44 place-items-center rounded-2xl border border-ink-100">
            <Spinner />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2 rounded-2xl bg-ink-50 px-3.5 py-3">
            <Icon name="link" size={16} className="shrink-0 text-ink-400" />
            <span className="truncate font-mono text-xs text-ink-700">{url}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              size="sm"
              variant="outline"
              icon="copy"
              onClick={async () => {
                await copyToClipboard(url)
                toast.success('Lien copié.')
              }}
            >
              Copier le lien
            </Button>
            <Button size="sm" variant="outline" icon="download" onClick={() => qr && downloadUrl(qr, `qr-coffre-${vault.id}.png`)}>
              Télécharger le QR
            </Button>
          </div>
          <div className="flex gap-3 rounded-2xl bg-emerald-50 p-4">
            <Icon name="shieldCheck" size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            <p className="text-sm leading-relaxed text-emerald-800">
              Ce QR Code ne contient aucun document ni photo : il identifie seulement le coffre et mène à l'écran
              d'authentification.
            </p>
          </div>
        </div>
      </div>
    </Panel>
  )
}

function SecurityPanel({ vault, vaultKey, user, onChange, onDeleted }) {
  const toast = useToast()
  const [passwordModal, setPasswordModal] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [newRecovery, setNewRecovery] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [biometricsAvailable, setBiometricsAvailable] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setBiometricsAvailable)
  }, [])

  if (newRecovery) {
    return (
      <RecoveryCodeScreen
        vaultName={vault.name}
        code={newRecovery}
        doneLabel="Revenir au coffre"
        onDone={() => setNewRecovery(null)}
      />
    )
  }

  const toggleBiometrics = async () => {
    setBusy(true)
    try {
      const updated = vault.hasBiometric ? await removeBiometrics(vault) : await addBiometrics(vault, vaultKey, user.email)
      onChange(updated)
      toast.success(vault.hasBiometric ? 'Biométrie désactivée.' : 'Biométrie activée sur cet appareil.')
    } catch (err) {
      toast.error(err.message || "L'enrôlement biométrique a échoué.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <Panel>
        <SectionTitle icon="shield" title="Protection" subtitle="Les moyens d'ouvrir ce coffre." />
        <div className="space-y-3">
          <SecurityRow icon="key" title="Mot de passe" description="Secret principal : il chiffre la clé du coffre.">
            <Button size="sm" variant="outline" onClick={() => setPasswordModal(true)}>
              Modifier
            </Button>
          </SecurityRow>
          <SecurityRow
            icon="fingerprint"
            title="Déverrouillage biométrique"
            description={
              vault.hasBiometric
                ? 'Activé sur cet appareil. Aucune donnée biométrique n\'est stockée par l\'application.'
                : biometricsAvailable
                  ? "Utilise le capteur du téléphone via le système d'exploitation."
                  : "Aucun capteur compatible détecté sur cet appareil."
            }
          >
            <Button size="sm" variant={vault.hasBiometric ? 'dangerSoft' : 'outline'} loading={busy} disabled={!biometricsAvailable && !vault.hasBiometric} onClick={toggleBiometrics}>
              {vault.hasBiometric ? 'Désactiver' : 'Activer'}
            </Button>
          </SecurityRow>
          <SecurityRow
            icon="refresh"
            title="Code de récupération"
            description={
              vault.recoveryUsedAt
                ? `Dernier renouvellement le ${formatDateTime(vault.recoveryIssuedAt)}.`
                : `Émis le ${formatDateTime(vault.recoveryIssuedAt)}. Il n'est plus consultable.`
            }
          >
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const result = await regenerateRecoveryCode(vault, vaultKey)
                onChange(result.vault)
                setNewRecovery(result.recoveryCode)
              }}
            >
              Renouveler
            </Button>
          </SecurityRow>
        </div>
      </Panel>

      <Panel>
        <SectionTitle icon="clock" title="Journal des accès" subtitle="Les 200 derniers évènements de ce coffre." />
        {vault.accessLog?.length ? (
          <ul className="divide-y divide-ink-100">
            {vault.accessLog.slice(0, 12).map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="flex items-center gap-3 py-3">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                    entry.result === 'failed' ? 'bg-rose-50 text-rose-600' : 'bg-ink-100 text-ink-500'
                  }`}
                >
                  <Icon name={entry.result === 'failed' ? 'alert' : 'check'} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-800">
                    {LOG_LABELS[entry.action] || entry.action}
                    {entry.file ? ` — ${entry.file}` : ''}
                  </span>
                  <span className="block text-xs text-ink-400">{formatDateTime(entry.at)}</span>
                </span>
                {entry.method && <Badge tone="neutral">{entry.method === 'biometric' ? 'biométrie' : entry.method === 'recovery' ? 'récupération' : 'mot de passe'}</Badge>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">Aucun évènement enregistré.</p>
        )}
      </Panel>

      <Panel className="border-rose-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-sm font-bold text-ink-900">Supprimer ce coffre</p>
            <p className="hint mt-0.5">Tous les fichiers chiffrés qu'il contient seront effacés.</p>
          </div>
          <Button variant="dangerSoft" icon="trash" onClick={() => setConfirmDelete(true)}>
            Supprimer
          </Button>
        </div>
      </Panel>

      <Modal
        open={passwordModal}
        onClose={() => setPasswordModal(false)}
        title="Modifier le mot de passe"
        description="Le coffre est déverrouillé : la clé sera simplement re-protégée par le nouveau mot de passe."
        size="sm"
        footer={
          <Button
            full
            onClick={async () => {
              setError(null)
              if (password.length < 8) {
                setError('Au moins 8 caractères.')
                return
              }
              if (password !== confirm) {
                setError('Les mots de passe ne correspondent pas.')
                return
              }
              const updated = await changePassword(vault, vaultKey, password)
              onChange(updated)
              setPassword('')
              setConfirm('')
              setPasswordModal(false)
              toast.success('Mot de passe modifié.')
            }}
          >
            Enregistrer
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Nouveau mot de passe" error={error}>
            <PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirmer">
            <PasswordInput value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Supprimer « ${vault.name} » ?`}
        description="Les fichiers seront définitivement effacés."
        confirmLabel="Supprimer le coffre"
        onConfirm={async () => {
          await repo.vaults.remove(vault.id)
          toast.success('Coffre supprimé.')
          onDeleted()
        }}
      />
    </div>
  )
}

function SecurityRow({ icon, title, description, children }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-ink-100 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink-900 text-white">
        <Icon name={icon} size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold text-ink-900">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{description}</p>
      </div>
      {children}
    </div>
  )
}
