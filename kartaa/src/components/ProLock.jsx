import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal } from './ui'
import { Icon } from './ui/Icons'
import { can } from '../config/app.config'
import { useAuth } from '../state/AuthContext'
import { useTranslation } from '../i18n'

/**
 * Verrou des fonctionnalités Pro.
 *
 * Un seul message, un seul bouton, un seul chemin : « Voir Pro » mène toujours
 * à la page Mon abonnement. Aucun autre parcours d'achat dans l'application.
 */
const ProLockContext = createContext(null)

export function ProLockProvider({ children }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { t } = useTranslation()

  /** Retourne true si l'accès est permis ; sinon affiche le message et retourne false. */
  const requirePro = useCallback((capability) => {
    if (can(user, capability)) return true
    setOpen(true)
    return false
  }, [user])

  const value = useMemo(() => ({ requirePro, showProLock: () => setOpen(true) }), [requirePro])

  return (
    <ProLockContext.Provider value={value}>
      {children}
      <Modal open={open} onClose={() => setOpen(false)} title={t('pro.locked')} size="sm">
        <div className="text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gold-100 text-gold-700">
            <Icon name="lock" size={26} />
          </span>
          <p className="text-sm leading-relaxed text-ink-600">{t('pro.lockedText')}</p>
          <div className="mt-6 space-y-2">
            <Button
              full
              icon="crown"
              onClick={() => {
                setOpen(false)
                navigate('/app/abonnement')
              }}
            >
              {t('pro.see')}
            </Button>
            <Button full variant="ghost" onClick={() => setOpen(false)}>
              {t('pro.close')}
            </Button>
          </div>
        </div>
      </Modal>
    </ProLockContext.Provider>
  )
}

export function useProLock() {
  const context = useContext(ProLockContext)
  if (!context) throw new Error('useProLock doit être utilisé dans ProLockProvider')
  return context
}

/** Petit cadenas à poser sur un élément réservé à l'abonnement Pro. */
export function ProBadge({ className = '' }) {
  const { t } = useTranslation()
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-2.5 py-1 text-xs font-bold text-gold-700 ${className}`}>
      <Icon name="lock" size={12} />
      {t('plan.pro')}
    </span>
  )
}
