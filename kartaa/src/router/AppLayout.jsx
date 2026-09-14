import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Icon, Logo } from '../components/ui/Icons'
import { Avatar, Badge, Button, Modal } from '../components/ui'
import { useAuth } from '../state/AuthContext'
import { useData } from '../state/DataContext'
import { isPro } from '../config/app.config'
import { useTranslation } from '../i18n'
import { initialsOf } from '../lib/format'

const NAV = [
  { to: '/app', label: 'Accueil', icon: 'home', end: true },
  { to: '/app/cartes', label: 'Mes cartes', icon: 'card' },
  { to: '/app/scanner', label: 'Scanner', icon: 'scan' },
  { to: '/app/coffres', label: 'Mes coffres', icon: 'vault' },
  { to: '/app/statistiques', label: 'Statistiques', icon: 'chart' },
  { to: '/app/profil', label: 'Profil', icon: 'user' },
]

/** Les quatre entrées qui encadrent le scanner, en bas de l'écran mobile. */
const NAV_MOBILE = NAV.filter((item) => item.to !== '/app/scanner' && item.to !== '/app/profil')

export default function AppLayout() {
  const { user } = useAuth()
  const { stats } = useData()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const { t } = useTranslation()
  const pro = isPro(user)

  return (
    <div className="min-h-screen bg-ink-50">
      {/* ----------------------------------------------------- barre latérale */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-100 bg-white px-4 py-6 lg:flex">
        <Link to="/app" className="mb-8 px-2">
          <Logo size={34} />
        </Link>
        <nav className="flex-1 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-ink-50 hover:text-ink-900'
                }`
              }
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Button icon="plus" full className="mb-4" onClick={() => setCreateOpen(true)}>
          Créer
        </Button>
        <Link to="/app/profil" className="flex items-center gap-3 rounded-2xl p-2 hover:bg-ink-50">
          <Avatar src={user?.avatarUrl} initials={initialsOf(user?.firstName, user?.lastName)} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-ink-900">
              {user?.firstName} {user?.lastName}
            </span>
            <span className="block truncate text-xs text-ink-400">{pro ? t('plan.pro') : t('plan.free')}</span>
          </span>
        </Link>
      </aside>

      {/* ------------------------------------------------------------ entête */}
      <header className="sticky top-0 z-20 border-b border-ink-100 bg-white/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-5 py-3.5">
          <Link to="/app">
            <Logo size={30} />
          </Link>
          <div className="flex items-center gap-2">
            {pro && <Badge tone="gold" icon="crown">{t('plan.pro')}</Badge>}
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-soft transition-transform active:scale-95"
              aria-label="Créer"
            >
              <Icon name="plus" size={19} />
            </button>
            <Link to="/app/profil">
              <Avatar src={user?.avatarUrl} initials={initialsOf(user?.firstName, user?.lastName)} size={36} />
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------ contenu */}
      <main className="pb-28 lg:ml-64 lg:pb-10">
        <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </div>
      </main>

      {/* --------------------------------------------- navigation mobile */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-center px-2 pb-2 pt-2.5">
          {NAV_MOBILE.slice(0, 2).map((item) => (
            <MobileLink key={item.to} item={item} />
          ))}
          <NavLink
            to="/app/scanner"
            className={({ isActive }) =>
              `mx-auto -mt-6 grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lift transition-transform active:scale-95 ${
                isActive ? 'bg-ink-900 ring-4 ring-brand-100' : 'bg-brand-600'
              }`
            }
            aria-label="Scanner un QR Code"
          >
            <Icon name="scan" size={26} />
          </NavLink>
          {NAV_MOBILE.slice(2, 4).map((item) => (
            <MobileLink key={item.to} item={item} />
          ))}
        </div>
      </nav>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Que voulez-vous créer ?" size="sm">
        <div className="space-y-3">
          <CreateChoice
            icon="card"
            title="Une carte de visite"
            description="Vos coordonnées, votre mini-site et votre QR Code."
            badge={stats.canCreateCard ? null : 'Limite atteinte'}
            onClick={() => {
              setCreateOpen(false)
              navigate(stats.canCreateCard ? '/app/cartes/nouvelle' : '/app/profil')
            }}
          />
          <CreateChoice
            icon="vault"
            title="Un Coffre Sécurité"
            description="Photos, vidéos et documents protégés."
            badge={stats.canCreateVault ? null : 'Limite atteinte'}
            onClick={() => {
              setCreateOpen(false)
              navigate(stats.canCreateVault ? '/app/coffres/nouveau' : '/app/profil')
            }}
          />
        </div>
      </Modal>
    </div>
  )
}

/**
 * Onglet de la barre du bas : l'icône seule, sans libellé.
 * Le nom reste porté par aria-label et title — indispensable pour les lecteurs
 * d'écran, puisque plus rien ne l'écrit à l'écran.
 */
function MobileLink({ item }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      aria-label={item.label}
      title={item.label}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1.5 rounded-xl py-1 transition-colors ${
          isActive ? 'text-brand-700' : 'text-ink-400'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={item.icon} size={26} strokeWidth={isActive ? 2.2 : 1.7} />
          {/* Un point remplace le libellé pour signaler l'onglet ouvert. */}
          <span className={`h-1.5 w-1.5 rounded-full transition-colors ${isActive ? 'bg-brand-600' : 'bg-transparent'}`} />
        </>
      )}
    </NavLink>
  )
}

function CreateChoice({ icon, title, description, badge, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl border border-ink-200 p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon name={icon} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-display text-sm font-bold text-ink-900">
          {title}
          {badge && <Badge tone="gold">{badge}</Badge>}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{description}</span>
      </span>
      <Icon name="chevronRight" size={18} className="shrink-0 text-ink-300" />
    </button>
  )
}
