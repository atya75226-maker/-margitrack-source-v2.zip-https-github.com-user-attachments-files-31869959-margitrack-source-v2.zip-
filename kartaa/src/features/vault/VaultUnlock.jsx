import { useEffect, useState } from 'react'
import { Button, Field, Panel, PasswordInput, Input, Progress } from '../../components/ui'
import { Icon, Logo } from '../../components/ui/Icons'
import RecoveryCodeScreen from './RecoveryCodeScreen'
import { lockStatus, unlockWithBiometrics, unlockWithPassword, resetPasswordWithRecovery, MAX_ATTEMPTS } from '../../lib/vaultService'
import { normalizeRecoveryCode, passwordStrength, STRENGTH_LABELS } from '../../lib/crypto'
import { useToast } from '../../state/ToastContext'
import { repo } from '../../lib/storage'
import { isPlatformAuthenticatorAvailable } from '../../lib/webauthn'
import * as vaultPublic from '../../lib/vaultPublic'

/**
 * Écran de déverrouillage. Tant qu'il n'a pas rendu la clé du coffre,
 * aucun fichier n'est déchiffré ni même consultable.
 */
export default function VaultUnlock({ vault: initialVault, onUnlocked, standalone = false, publicAccess = false }) {
  const [vault, setVault] = useState(initialVault)
  const [mode, setMode] = useState('password')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [, setTick] = useState(0)
  // Le bouton n'apparaît que si CET appareil sait vraiment lire une empreinte :
  // proposer un déverrouillage impossible ne mène qu'à une erreur.
  const [capteurDisponible, setCapteurDisponible] = useState(false)

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setCapteurDisponible)
  }, [])

  useEffect(() => setVault(initialVault), [initialVault])

  const status = lockStatus(vault)

  useEffect(() => {
    if (!status.locked) return undefined
    const timer = setInterval(() => setTick((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [status.locked])

  /**
   * Relit l'état du coffre après chaque tentative — nombre d'essais restants et
   * verrou en cours. Un visiteur venu par le QR Code n'a aucun droit sur la
   * table : pour lui, seul vault_intro répond, et il ne livre ni le nom du
   * coffre ni son contenu.
   */
  const refresh = async () => {
    const fresh = publicAccess ? await vaultPublic.intro(vault.id) : await repo.vaults.get(vault.id)
    if (fresh) setVault({ ...vault, ...fresh })
    return fresh ? { ...vault, ...fresh } : vault
  }

  const submitPassword = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const ouverture = await unlockWithPassword(vault, password)
      setPassword('')
      onUnlocked(ouverture, await refresh())
    } catch (err) {
      setError(err.message)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const submitBiometrics = async () => {
    setBusy(true)
    setError(null)
    try {
      const ouverture = await unlockWithBiometrics(vault)
      onUnlocked(ouverture, await refresh())
    } catch (err) {
      setError(err.message || 'Authentification biométrique refusée.')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'recovery') {
    return (
      <RecoveryFlow
        vault={vault}
        onCancel={() => setMode('password')}
        onDone={async (ouverture) => onUnlocked(ouverture, await refresh())}
      />
    )
  }

  const remaining = Math.ceil(status.remainingMs / 1000)

  return (
    <div className={standalone ? 'mx-auto w-full max-w-md' : ''}>
      {standalone && (
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
      )}
      <Panel className="overflow-hidden !p-0">
        <div className="relative overflow-hidden bg-ink-950 px-6 py-8 text-center text-white">
          <span className="mesh absolute inset-0 opacity-60" />
          <span className="relative mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gold-400 text-ink-900">
            <Icon name="lock" size={30} />
          </span>
          <p className="relative text-xs font-extrabold uppercase tracking-[.2em] text-gold-400">Coffre Sécurité</p>
          <h1 className="relative mt-2 font-display text-2xl font-extrabold">
            {vault.name || 'Coffre protégé'}
          </h1>
          <p className="relative mt-1.5 text-sm text-white/60">
            {vault.name
              ? 'Ce coffre est protégé.'
              : 'Saisissez le mot de passe pour accéder à son contenu.'}
          </p>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {status.locked ? (
            <div className="rounded-2xl bg-rose-50 p-4 text-center">
              <Icon name="clock" size={22} className="mx-auto mb-2 text-rose-600" />
              <p className="text-sm font-bold text-rose-700">Trop de tentatives</p>
              <p className="mt-1 text-sm text-rose-700">
                Réessayez dans {remaining > 60 ? `${Math.ceil(remaining / 60)} min` : `${remaining} s`}.
              </p>
            </div>
          ) : (
            <form onSubmit={submitPassword} className="space-y-4">
              <Field label="Mot de passe" error={error}>
                <PasswordInput
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  autoFocus
                />
              </Field>
              {!error && vault.failedAttempts > 0 && (
                <p className="text-xs font-semibold text-gold-700">
                  {MAX_ATTEMPTS - vault.failedAttempts} tentative(s) avant blocage temporaire.
                </p>
              )}
              <Button type="submit" full size="lg" icon="unlock" loading={busy} disabled={!password}>
                Déverrouiller
              </Button>
            </form>
          )}

          {vault.hasBiometric && capteurDisponible && !status.locked && (
            <Button full variant="outline" icon="fingerprint" onClick={submitBiometrics} disabled={busy}>
              Utiliser mon empreinte digitale
            </Button>
          )}

          <button
            type="button"
            onClick={() => setMode('recovery')}
            className="w-full py-1 text-center text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            Mot de passe oublié ?
          </button>
        </div>
      </Panel>

      <p className="mx-auto mt-4 flex max-w-sm items-start justify-center gap-2 text-center hint">
        <Icon name="shieldCheck" size={14} className="mt-0.5 shrink-0" />
        Les fichiers restent chiffrés tant que l'authentification n'a pas réussi.
      </p>
    </div>
  )
}

function RecoveryFlow({ vault, onCancel, onDone }) {
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const toast = useToast()
  const strength = passwordStrength(password)

  if (result) {
    return (
      <RecoveryCodeScreen
        vaultName={vault.name || 'Votre coffre'}
        code={result.recoveryCode}
        doneLabel="Ouvrir mon coffre"
        onDone={() => onDone({ key: result.vaultKey, token: result.token })}
      />
    )
  }

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setBusy(true)
    try {
      const outcome = await resetPasswordWithRecovery(vault, code, password)
      toast.success('Mot de passe réinitialisé.')
      setResult(outcome)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Panel>
        <div className="mb-5 flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <Icon name="key" size={20} />
          </span>
          <div>
            <p className="font-display text-base font-bold text-ink-900">Mot de passe oublié</p>
            <p className="hint mt-0.5">Saisissez le code de récupération remis à la création du coffre.</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Code de récupération" error={error}>
            <Input
              value={code}
              onChange={(event) => setCode(normalizeRecoveryCode(event.target.value))}
              placeholder="8K7P-42LM-X91Q"
              className="font-mono tracking-[.15em]"
              autoFocus
            />
          </Field>
          <Field label="Nouveau mot de passe">
            <PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
          </Field>
          {password && (
            <div className="flex items-center gap-3">
              <Progress value={(strength / 4) * 100} tone={strength >= 3 ? 'success' : strength === 2 ? 'gold' : 'danger'} className="flex-1" />
              <span className="w-24 text-right text-xs font-bold text-ink-500">{STRENGTH_LABELS[strength]}</span>
            </div>
          )}
          <Field label="Confirmer le nouveau mot de passe">
            <PasswordInput value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" />
          </Field>
          <p className="hint">
            Après la réinitialisation, un nouveau code de récupération est généré : l'ancien cesse de fonctionner.
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="outline" full onClick={onCancel}>
              Retour
            </Button>
            <Button type="submit" full loading={busy} disabled={!code}>
              Réinitialiser
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  )
}
