import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Modal, Panel, SectionTitle } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import { useAuth } from '../../state/AuthContext'
import { useToast } from '../../state/ToastContext'
import { useTranslation, LANGUAGES } from '../../i18n'
import { FEATURE_FLAGS, isPro, PRO_PRICE } from '../../config/app.config'

const PRO_FEATURES = ['sub.f1', 'sub.f2', 'sub.f3', 'sub.f4', 'sub.f5', 'sub.f6', 'sub.f7', 'sub.f8']
const FREE_FEATURES = ['free.f1', 'free.f2', 'free.f3', 'free.f4', 'free.f5', 'free.f6']

/**
 * Page unique d'abonnement. Tous les chemins de l'application y mènent, et il
 * n'existe qu'une offre payante : Pro, 5 000 FCFA par mois.
 */
export default function SubscriptionPage() {
  const { user, updateUser } = useAuth()
  const { t, price, language, setLanguage } = useTranslation()
  const toast = useToast()
  const [payment, setPayment] = useState(false)
  const [busy, setBusy] = useState(false)
  const pro = isPro(user)

  const activate = async () => {
    setBusy(true)
    try {
      await updateUser({ plan: 'pro' })
      toast.success(t('sub.activated'))
      setPayment(false)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/app/profil" className="rounded-xl p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-900" aria-label="Retour">
            <Icon name="arrowLeft" size={20} />
          </Link>
          <h1 className="font-display text-2xl font-extrabold text-ink-900">{t('sub.title')}</h1>
        </div>

        <div className="flex gap-1 rounded-2xl bg-ink-100 p-1">
          {LANGUAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setLanguage(item.id)}
              className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-all ${
                language === item.id ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-500'
              }`}
            >
              {item.flag} {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* ------------------------------------------------------ offre actuelle */}
      <Panel className={pro ? 'border-gold-200 bg-gold-50/40' : ''}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-ink-400">{t('sub.current')}</p>
            <p className="mt-1 font-display text-xl font-extrabold text-ink-900">
              {pro ? t('sub.currentPro') : t('sub.currentFree')}
            </p>
          </div>
          <Badge tone={pro ? 'gold' : 'neutral'} icon={pro ? 'crown' : null}>
            {pro ? t('plan.pro') : t('plan.free')}
          </Badge>
        </div>
      </Panel>

      {/* --------------------------------------------------------- passer à Pro */}
      <Panel className="relative overflow-hidden !p-0">
        <div className="relative overflow-hidden bg-ink-950 px-6 py-8 text-white">
          <span className="mesh absolute inset-0 opacity-70" />
          <div className="relative">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-gold-400 px-3 py-1 text-xs font-extrabold text-ink-900">
              <Icon name="crown" size={13} /> {t('plan.pro')}
            </span>
            <h2 className="font-display text-3xl font-extrabold">{t('sub.upgradeTitle')}</h2>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-4xl font-extrabold text-gold-400">{price(PRO_PRICE)}</span>
              <span className="text-sm font-semibold text-white/70">{t('plan.perMonth')}</span>
            </p>
            <p className="mt-4 max-w-md leading-relaxed text-white/75">{t('sub.upgradeIntro')}</p>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <ul className="space-y-2.5">
            {PRO_FEATURES.map((key) => (
              <li key={key} className="flex items-start gap-2.5 text-sm text-ink-700">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                {t(key)}
              </li>
            ))}
          </ul>

          {pro ? (
            <Button
              variant="outline"
              full
              className="mt-6"
              onClick={async () => {
                await updateUser({ plan: 'free' })
                toast.info(t('sub.reverted'))
              }}
            >
              {t('sub.cancel')}
            </Button>
          ) : (
            <Button size="lg" full className="mt-6" icon="crown" onClick={() => setPayment(true)}>
              {t('sub.cta')}
            </Button>
          )}
        </div>
      </Panel>

      {/* ---------------------------------------------------------- offre libre */}
      <Panel>
        <SectionTitle icon="check" title={t('sub.freeTitle')} />
        <ul className="space-y-2.5">
          {FREE_FEATURES.map((key) => (
            <li key={key} className="flex items-start gap-2.5 text-sm text-ink-600">
              <Icon name="check" size={16} className="mt-0.5 shrink-0 text-ink-300" />
              {t(key)}
            </li>
          ))}
        </ul>
      </Panel>

      <Modal
        open={payment}
        onClose={() => setPayment(false)}
        title={t('sub.paymentPending')}
        size="sm"
        footer={
          <Button full loading={busy} onClick={activate}>
            {t('sub.activate')}
          </Button>
        }
      >
        <p className="text-sm leading-relaxed text-ink-600">{t('sub.paymentNote')}</p>
        <div className="mt-4 rounded-2xl bg-ink-50 p-4 text-center">
          <p className="font-display text-2xl font-extrabold text-ink-900">{price(PRO_PRICE)}</p>
          <p className="mt-0.5 text-xs font-semibold text-ink-500">{t('plan.perMonth')}</p>
        </div>
        {!FEATURE_FLAGS.payments && (
          <p className="hint mt-3 text-center">
            Prestataire de paiement à connecter — voir FEATURE_FLAGS.payments.
          </p>
        )}
      </Modal>
    </div>
  )
}
