import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Icon, Logo } from '../components/ui/Icons'
import { Avatar, Badge, Button } from '../components/ui'
import { useAuth } from '../state/AuthContext'
import { useData } from '../state/DataContext'
import { isPro } from '../config/app.config'
import { useTranslation } from '../i18n'
import { useProLock } from '../components/ProLock'
import { initialsOf } from '../lib/format'
import EtatReseau from '../components/EtatReseau'

const NAV = [
  { to: '/app', label: 'Accueil', icon: 'home', end: true },
  { to: '/app/cartes', label: 'Mes cartes', icon: 'card' },
  { to: '/app/scanner', label: 'Scanner', icon: 'scan' },
  { to: '/app/statistiques', label: 'Statistiques', icon: 'chart' },
  { to: '/app/profil', label: 'Profil', icon: 'user' },
]

/**
 * Barre du bas : le chemin principal du produit, et lui seul.
 *
 * Accueil, Mes cartes, Créer, Scanner, Profil. « Créer » porte le bouton mis en
 * avant, puisque c'est le geste que l'application existe pour provoquer.
 */
// Désigné par libellé, et non par position : retirer une entrée de NAV ne doit
// pas décaler silencieusement la barre du bas.
const entree = (label) => NAV.find((item) => item.label === label)

const NAV_MOBILE = [
  entree('Accueil'),
  entree('Mes cartes'),
  { action: 'create', label: 'Créer', icon: 'plus' },
  entree('Scanner'),
  entree('Profil'),
]

export default function AppLayout() {
  const { user } = useAuth()
  const { stats } = useData()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { showProLock } = useProLock()
  const pro = isPro(user)

  /**
   * Le bouton « Créer » mène à la création de carte, sans détour.
   */
  const creerUneCarte = () => {
    if (stats.canCreateCard) navigate('/app/cartes/nouvelle')
    else showProLock('multipleCards')
  }

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
        <Button icon="plus" full className="mb-4" onClick={creerUneCarte}>
          Créer ma carte
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
            <EtatReseau compact />
            {pro && <Badge tone="gold" icon="crown">{t('plan.pro')}</Badge>}
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
        <div className="mx-auto grid max-w-lg grid-cols-5 items-center px-1 pb-2 pt-2.5">
          {NAV_MOBILE.map((item) =>
            item.action === 'create' ? (
              <MobileAction key="create" item={item} onClick={creerUneCarte} />
            ) : (
              <MobileLink key={item.to} item={item} />
            ),
          )}
        </div>
      </nav>

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
          <Icon name={item.icon} size={23} strokeWidth={isActive ? 2.2 : 1.7} />
          {/* Un point remplace le libellé pour signaler l'onglet ouvert. */}
          <span className={`h-1.5 w-1.5 rounded-full transition-colors ${isActive ? 'bg-brand-600' : 'bg-transparent'}`} />
        </>
      )}
    </NavLink>
  )
}

/**
 * Bouton « Créer » de la barre du bas : même gabarit que les onglets, mais il
 * ouvre la fenêtre de création au lieu de naviguer.
 */
function MobileAction({ item, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={item.label}
      title={item.label}
      className="flex flex-col items-center gap-1.5 rounded-xl py-1 text-ink-400 transition-colors active:text-brand-700"
    >
      {/* Le geste que l'application existe pour provoquer : créer sa carte. */}
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 text-white shadow-soft transition-transform active:scale-95">
        <Icon name={item.icon} size={23} strokeWidth={2.2} />
      </span>
      <span className="h-1.5 w-1.5 rounded-full bg-transparent" />
    </button>
  )
}
