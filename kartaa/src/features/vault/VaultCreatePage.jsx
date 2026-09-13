import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Field, Input, Panel, PasswordInput, Progress, Stepper } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import RecoveryCodeScreen from './RecoveryCodeScreen'
import { useAuth } from '../../state/AuthContext'
import { useToast } from '../../state/ToastContext'
import { createVault } from '../../lib/vaultService'
import { passwordStrength, STRENGTH_LABELS } from '../../lib/crypto'
import { isPlatformAuthenticatorAvailable } from '../../lib/webauthn'
import { unlock as rememberVaultKey } from '../../lib/vaultSession'

const STEPS = ['Nom du coffre', 'Protection', 'Code de récupération']

const SUGGESTIONS = ['Mes souvenirs', 'Documents importants', 'Diplômes et certificats', 'Photos de famille']

export default function VaultCreatePage() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [useBiometrics, setUseBiometrics] = useState(false)
  const [biometricsAvailable, setBiometricsAvailable] = useState(false)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setBiometricsAvailable)
  }, [])

  const strength = passwordStrength(password)

  const submit = async () => {
    const next = {}
    if (password.length < 8) next.password = 'Au moins 8 caractères.'
    if (password !== confirm) next.confirm = 'Les mots de passe ne correspondent pas.'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      const created = await createVault({
        userId: user.id,
        name: name.trim(),
        password,
        useBiometrics: useBiometrics && biometricsAvailable,
        userLabel: user.email,
      })
      rememberVaultKey(created.vault.id, created.vaultKey)
      setResult(created)
      setPassword('')
      setConfirm('')
      setStep(2)
    } catch (error) {
      toast.error(error.message || "La création du coffre a échoué.")
    } finally {
      setBusy(false)
    }
  }

  if (step === 2 && result) {
    return (
      <RecoveryCodeScreen
        vaultName={result.vault.name}
        code={result.recoveryCode}
        onDone={() => navigate(`/app/coffres/${result.vault.id}`, { replace: true })}
        doneLabel="Ouvrir mon coffre"
      />
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (step === 0 ? navigate(-1) : setStep(0))}
          className="rounded-xl p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-900"
          aria-label="Retour"
        >
          <Icon name="arrowLeft" size={20} />
        </button>
        <div>
          <h1 className="font-display text-xl font-extrabold text-ink-900 sm:text-2xl">Créer un Coffre Sécurité</h1>
          <p className="text-sm text-ink-500">Étape {step + 1} sur 3 — {STEPS[step]}</p>
        </div>
      </header>

      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <>
          <Panel>
            <Field label="Nom du coffre" required hint="Un nom qui vous parle : vous le verrez sur le QR Code.">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Mes souvenirs" autoFocus />
            </Field>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setName(item)}
                  className="rounded-full border border-ink-200 px-3.5 py-1.5 text-xs font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700"
                >
                  {item}
                </button>
              ))}
            </div>
          </Panel>
          <Button full size="lg" disabled={!name.trim()} iconRight="chevronRight" onClick={() => setStep(1)}>
            Continuer
          </Button>
        </>
      )}

      {step === 1 && (
        <>
          <Panel className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                <Icon name="key" size={20} />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-ink-900">Mot de passe du coffre</p>
                <p className="hint mt-0.5">Différent de celui de votre compte, c'est lui qui chiffre vos fichiers.</p>
              </div>
            </div>
            <Field label="Mot de passe" required error={errors.password}>
              <PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 caractères minimum" autoComplete="new-password" />
            </Field>
            {password && (
              <div className="flex items-center gap-3">
                <Progress value={(strength / 4) * 100} tone={strength >= 3 ? 'success' : strength === 2 ? 'gold' : 'danger'} className="flex-1" />
                <span className="w-24 text-right text-xs font-bold text-ink-500">{STRENGTH_LABELS[strength]}</span>
              </div>
            )}
            <Field label="Confirmer le mot de passe" required error={errors.confirm}>
              <PasswordInput value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" />
            </Field>
            <div className="flex gap-3 rounded-2xl bg-rose-50 p-4">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-rose-600" />
              <p className="text-sm leading-relaxed text-rose-800">
                Votre mot de passe ne pourra pas être affiché ultérieurement. Sans lui et sans votre code de
                récupération, les fichiers resteront illisibles.
              </p>
            </div>
          </Panel>

          <Panel>
            <button
              type="button"
              onClick={() => biometricsAvailable && setUseBiometrics((value) => !value)}
              disabled={!biometricsAvailable}
              className={`flex w-full items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition-all ${
                useBiometrics ? 'border-brand-600 bg-brand-50' : 'border-ink-100'
              } ${biometricsAvailable ? '' : 'opacity-60'}`}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink-900 text-white">
                <Icon name="fingerprint" size={21} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-sm font-bold text-ink-900">Ajouter le déverrouillage biométrique</span>
                <span className="mt-1 block text-xs leading-relaxed text-ink-500">
                  {biometricsAvailable
                    ? "Utilise l'empreinte ou le visage géré par votre téléphone. Aucune donnée biométrique n'entre dans l'application."
                    : "Cet appareil ne propose pas de capteur compatible. Vous pourrez l'activer plus tard depuis un autre appareil."}
                </span>
              </span>
              {useBiometrics && <Icon name="check" size={20} className="mt-0.5 shrink-0 text-brand-600" />}
            </button>
          </Panel>

          <Button full size="lg" loading={busy} icon="lock" onClick={submit}>
            Protéger mon coffre
          </Button>
        </>
      )}
    </div>
  )
}
