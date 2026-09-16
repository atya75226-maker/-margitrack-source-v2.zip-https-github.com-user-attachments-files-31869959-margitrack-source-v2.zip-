import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Field, Input, Panel, PasswordInput, Progress, Stepper } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import RecoveryCodeScreen from './RecoveryCodeScreen'
import { useAuth } from '../../state/AuthContext'
import { useToast } from '../../state/ToastContext'
import { addBiometrics, createVault } from '../../lib/vaultService'
import { passwordStrength, STRENGTH_LABELS } from '../../lib/crypto'
import { isPlatformAuthenticatorAvailable } from '../../lib/webauthn'
import { unlock as rememberVaultKey } from '../../lib/vaultSession'

const STEPS = ['Nom du coffre', 'Protection', 'Code de récupération']

/**
 * Message affiché quand l'enrôlement de l'empreinte échoue.
 * Le coffre, lui, est déjà créé et protégé par son mot de passe : il faut le
 * dire, sinon l'échec se lit comme une perte de données.
 */
const ECHEC_BIOMETRIE =
  "Une erreur technique empêche actuellement d'activer cette protection. Vos données n'ont pas été " +
  'supprimées : votre coffre est créé et protégé par son mot de passe.'

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
  // Étape séparée, volontairement placée après le code de récupération.
  const [enrolement, setEnrolement] = useState(null) // null | 'attente' | 'encours' | 'echec'
  const [erreurBiometrie, setErreurBiometrie] = useState(null)

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
      // Aucune opération biométrique ici : le code de récupération doit être
      // affiché avant tout ce qui peut faire passer l'application au second plan.
      const created = await createVault({ name: name.trim(), password })
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

  const ouvrirLeCoffre = () => navigate(`/app/coffres/${result.vault.id}`, { replace: true })

  /**
   * Enrôlement de l'empreinte, une fois le code de récupération sauvegardé.
   * Un échec ne fait jamais quitter l'écran : il s'affiche, et on peut réessayer.
   */
  const activerBiometrie = async () => {
    setEnrolement('encours')
    setErreurBiometrie(null)
    try {
      await addBiometrics(result.vault, result.vaultKey, user.email)
      toast.success('Sécurité renforcée activée sur cet appareil.')
      ouvrirLeCoffre()
    } catch (error) {
      setErreurBiometrie(error?.message || null)
      setEnrolement('echec')
    }
  }

  if (step === 2 && result) {
    if (enrolement) {
      return (
        <EcranBiometrie
          etat={enrolement}
          detail={erreurBiometrie}
          onActiver={activerBiometrie}
          onPasser={ouvrirLeCoffre}
        />
      )
    }
    return (
      <RecoveryCodeScreen
        vaultName={result.vault.name}
        code={result.recoveryCode}
        onDone={() => {
          // L'empreinte n'est demandée qu'ici : le code est noté, une
          // interruption du système ne peut plus rien faire perdre.
          if (useBiometrics && biometricsAvailable) setEnrolement('attente')
          else ouvrirLeCoffre()
        }}
        doneLabel={useBiometrics && biometricsAvailable ? "J'ai conservé mon code" : 'Ouvrir mon coffre'}
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
                    ? "Utilise l'empreinte ou le visage géré par votre téléphone. Elle vous sera demandée après votre code de récupération, pour qu'aucune interruption ne l'efface. Aucune donnée biométrique n'entre dans l'application."
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

/**
 * Dernière étape, facultative : l'empreinte.
 * Le coffre est déjà créé, le code de récupération déjà sauvegardé. Rien ne se
 * perd si le système reprend la main pendant la demande du capteur — et si elle
 * échoue, on le dit au lieu de renvoyer l'utilisateur ailleurs.
 */
function EcranBiometrie({ etat, detail, onActiver, onPasser }) {
  const echec = etat === 'echec'
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="text-center">
        <span className={`mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl ${echec ? 'bg-rose-50 text-rose-600' : 'bg-ink-900 text-white'}`}>
          <Icon name={echec ? 'alert' : 'fingerprint'} size={30} />
        </span>
        <h1 className="font-display text-2xl font-extrabold text-ink-900">
          {echec ? "Impossible d'activer la sécurité renforcée" : 'Dernière étape : votre empreinte'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          {echec
            ? ECHEC_BIOMETRIE
            : "Votre téléphone va demander votre empreinte ou votre visage. Votre coffre est déjà créé et votre code de récupération sauvegardé : même si cette étape est interrompue, vous ne perdez rien."}
        </p>
        {echec && detail && <p className="mt-2 text-xs text-ink-400">Détail : {detail}</p>}
      </div>

      <Panel className="space-y-3">
        <Button full size="lg" icon="fingerprint" loading={etat === 'encours'} onClick={onActiver}>
          {echec ? 'Réessayer' : 'Activer la sécurité renforcée'}
        </Button>
        <Button full variant="ghost" onClick={onPasser} disabled={etat === 'encours'}>
          Ouvrir mon coffre sans l'empreinte
        </Button>
        <p className="hint text-center">
          Vous pourrez l'activer à tout moment depuis la page du coffre, onglet Sécurité.
        </p>
      </Panel>
    </div>
  )
}
