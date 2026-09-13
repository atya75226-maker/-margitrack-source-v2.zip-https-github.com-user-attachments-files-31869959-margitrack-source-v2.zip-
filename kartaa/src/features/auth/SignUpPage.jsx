import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthShell from './AuthShell'
import { Button, Field, Input, PasswordInput, Progress } from '../../components/ui'
import { useAuth } from '../../state/AuthContext'
import { useToast } from '../../state/ToastContext'
import { passwordStrength, STRENGTH_LABELS } from '../../lib/crypto'

const EMPTY = { firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '' }

export default function SignUpPage() {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const { signUp } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const nextRoute = params.get('produit') === 'coffre' ? '/app/coffres/nouveau' : '/app/cartes/nouvelle'

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const validate = () => {
    const next = {}
    if (!form.firstName.trim()) next.firstName = 'Indiquez votre prénom.'
    if (!form.lastName.trim()) next.lastName = 'Indiquez votre nom.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Adresse e-mail invalide.'
    if (form.phone.replace(/\D/g, '').length < 8) next.phone = 'Numéro de téléphone invalide.'
    if (form.password.length < 8) next.password = 'Au moins 8 caractères.'
    if (form.password !== form.confirm) next.confirm = 'Les mots de passe ne correspondent pas.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!validate()) return
    setBusy(true)
    try {
      await signUp(form)
      toast.success('Bienvenue ! Votre compte est créé.')
      navigate(nextRoute, { replace: true })
    } catch (error) {
      toast.error(error.message)
      setErrors({ email: error.message })
    } finally {
      setBusy(false)
    }
  }

  const strength = passwordStrength(form.password)

  return (
    <AuthShell
      title="Créer mon compte"
      subtitle="Quelques informations suffisent. Vous pourrez tout modifier ensuite."
      footer={
        <>
          Vous avez déjà un compte ?{' '}
          <Link to="/connexion" className="link">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" required error={errors.firstName}>
            <Input value={form.firstName} onChange={set('firstName')} placeholder="Awa" autoComplete="given-name" />
          </Field>
          <Field label="Nom" required error={errors.lastName}>
            <Input value={form.lastName} onChange={set('lastName')} placeholder="Traoré" autoComplete="family-name" />
          </Field>
        </div>
        <Field label="Adresse e-mail" required error={errors.email}>
          <Input type="email" icon="mail" value={form.email} onChange={set('email')} placeholder="vous@exemple.com" autoComplete="email" />
        </Field>
        <Field label="Numéro de téléphone" required error={errors.phone}>
          <Input type="tel" icon="phone" value={form.phone} onChange={set('phone')} placeholder="+225 07 00 00 00 00" autoComplete="tel" />
        </Field>
        <Field label="Mot de passe" required error={errors.password}>
          <PasswordInput value={form.password} onChange={set('password')} placeholder="8 caractères minimum" autoComplete="new-password" />
        </Field>
        {form.password && (
          <div className="flex items-center gap-3">
            <Progress value={(strength / 4) * 100} tone={strength >= 3 ? 'success' : strength === 2 ? 'gold' : 'danger'} className="flex-1" />
            <span className="w-24 text-right text-xs font-bold text-ink-500">{STRENGTH_LABELS[strength]}</span>
          </div>
        )}
        <Field label="Confirmer le mot de passe" required error={errors.confirm}>
          <PasswordInput value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
        </Field>
        <Button type="submit" size="lg" full loading={busy} iconRight="arrowRight">
          Créer mon compte
        </Button>
        <p className="hint text-center">
          En créant un compte, vous acceptez de tester un prototype : vos données sont enregistrées sur cet appareil.
        </p>
      </form>
    </AuthShell>
  )
}
