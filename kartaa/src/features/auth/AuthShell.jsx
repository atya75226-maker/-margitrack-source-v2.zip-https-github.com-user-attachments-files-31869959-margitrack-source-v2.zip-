import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GoogleMark, Icon, Logo } from '../../components/ui/Icons'
import { useAuth } from '../../state/AuthContext'
import { useToast } from '../../state/ToastContext'

const HIGHLIGHTS = [
  { icon: 'card', text: 'Une carte de visite numérique prête en quelques minutes' },
  { icon: 'qr', text: 'Un QR Code qui ouvre votre mini-site professionnel' },
  { icon: 'shieldCheck', text: 'Un Coffre Sécurité chiffré pour vos documents' },
]

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink-950 p-12 text-white lg:flex">
        <div className="mesh absolute inset-0 opacity-80" />
        <div className="grain absolute inset-0 opacity-25" />
        <Link to="/" className="relative">
          <Logo tone="light" />
        </Link>
        <div className="relative">
          <h2 className="font-display text-4xl font-extrabold leading-tight text-balance">
            Votre identité.
            <br />
            Votre carte.
            <br />
            <span className="bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-transparent">Votre QR Code.</span>
          </h2>
          <ul className="mt-10 space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.text} className="flex items-center gap-3.5 text-white/75">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/10">
                  <Icon name={item.icon} size={19} className="text-gold-400" />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">
          Les fichiers du Coffre Sécurité sont chiffrés sur votre appareil avant d'être envoyés.
        </p>
      </div>

      <div className="flex flex-col justify-center bg-white px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <Link to="/" className="mb-8 inline-flex lg:hidden">
            <Logo />
          </Link>
          <h1 className="font-display text-2xl font-extrabold text-ink-900 sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-ink-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-ink-500">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

/**
 * « Continuer avec Google ». Le clic quitte l'application vers Google : le bouton
 * reste donc en attente jusqu'à la redirection, sans état de succès à afficher.
 */
export function GoogleButton({ label = 'Continuer avec Google', next = '/app' }) {
  const { signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await signInWithGoogle(next)
        } catch (error) {
          toast.error(error.message)
          setBusy(false)
        }
      }}
      className="flex h-[3.25rem] w-full items-center justify-center gap-3 rounded-2xl border border-ink-200 bg-white px-5 text-[0.95rem] font-semibold text-ink-800 transition-all hover:border-ink-300 hover:bg-ink-50 active:scale-[.99] disabled:opacity-70"
    >
      <GoogleMark size={20} />
      {busy ? 'Ouverture de Google…' : label}
    </button>
  )
}

export function Separator({ children = 'ou' }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-ink-200" />
      <span className="text-xs font-bold uppercase tracking-wide text-ink-400">{children}</span>
      <span className="h-px flex-1 bg-ink-200" />
    </div>
  )
}
