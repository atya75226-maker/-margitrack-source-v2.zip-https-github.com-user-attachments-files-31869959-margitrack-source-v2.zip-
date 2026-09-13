import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthShell from './AuthShell'
import { Button, Field, Input, PasswordInput } from '../../components/ui'
import { useAuth } from '../../state/AuthContext'
import { useToast } from '../../state/ToastContext'

export default function SignInPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const { signIn } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(form.email, form.password)
      toast.success('Content de vous revoir !')
      navigate(location.state?.from || '/app', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Se connecter"
      subtitle="Retrouvez vos cartes, vos statistiques et vos coffres."
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to="/inscription" className="link">
            Créer un compte gratuitement
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Adresse e-mail" required>
          <Input
            type="email"
            icon="mail"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="vous@exemple.com"
            autoComplete="email"
          />
        </Field>
        <Field label="Mot de passe" required error={error}>
          <PasswordInput
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            autoComplete="current-password"
          />
        </Field>
        <Button type="submit" size="lg" full loading={busy} iconRight="arrowRight">
          Se connecter
        </Button>
      </form>
    </AuthShell>
  )
}
