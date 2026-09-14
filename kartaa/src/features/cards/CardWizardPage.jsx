import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Panel, Spinner, Stepper } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import { CardArtwork, CardScaler } from '../../components/card/CardArtwork'
import StepIdentity from './steps/StepIdentity'
import StepSocials from './steps/StepSocials'
import StepAbout from './steps/StepAbout'
import StepCompanies from './steps/StepCompanies'
import StepDesign from './steps/StepDesign'
import { useAuth } from '../../state/AuthContext'
import { useToast } from '../../state/ToastContext'
import { useCardAssets } from '../../hooks/useCardAssets'
import { repo } from '../../lib/storage'
import { normalizeSlug, suggestSlug } from '../../lib/slug'
import { TEMPLATES, can } from '../../config/app.config'
import { ensureRows } from '../../lib/socialLinks'

const STEPS = ['Informations', 'Réseaux', 'Présentation', 'Entreprises', 'Design']

function emptyCard(user) {
  return {
    slug: '',
    template: 'standard',
    theme: { ...TEMPLATES[0].defaults },
    profile: {
      photoUrl: null,
      photoPath: null,
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      profession: '',
      phone: user?.phone || '',
      whatsapp: '',
      email: user?.email || '',
      address: '',
      city: '',
      country: '',
    },
    socialLinks: ensureRows([]),
    about: '',
    activities: [],
    companies: [],
    services: [],
    gallery: [],
  }
}

export default function CardWizardPage() {
  const { cardId } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => emptyCard(user))
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState({})
  const [slugError, setSlugError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!cardId)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    if (!cardId) return
    let cancelled = false
    Promise.all([repo.cards.get(cardId), repo.cards.socialLinks(cardId)]).then(([card, links]) => {
      if (cancelled) return
      if (card) setDraft({ ...card, socialLinks: ensureRows(links) })
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [cardId])

  const assets = useCardAssets(draft)
  const update = (patch) => setDraft((current) => ({ ...current, ...patch }))

  const validateIdentity = () => {
    const next = {}
    if (!draft.profile.firstName.trim()) next.firstName = 'Obligatoire.'
    if (!draft.profile.lastName.trim()) next.lastName = 'Obligatoire.'
    if (!draft.profile.phone.trim()) next.phone = 'Obligatoire.'
    if (draft.profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.profile.email)) next.email = 'Adresse invalide.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const goNext = () => {
    if (step === 0) {
      if (!validateIdentity()) {
        toast.error('Complétez les champs obligatoires.')
        return
      }
      if (!draft.slug) update({ slug: suggestSlug(draft.profile.firstName, draft.profile.lastName) })
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goBack = () => {
    if (step === 0) {
      navigate(-1)
      return
    }
    setStep((current) => current - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = async () => {
    if (!validateIdentity()) {
      setStep(0)
      toast.error('Complétez les champs obligatoires.')
      return
    }
    const slug = normalizeSlug(draft.slug, draft.profile.firstName, draft.profile.lastName)
    const available = await repo.cards.slugAvailable(slug, cardId || null)
    if (!available) {
      setSlugError('Cette adresse est déjà utilisée. Choisissez-en une autre.')
      setStep(STEPS.length - 1)
      return
    }
    // Les modèles Premium et VIP demandent l'abonnement Pro.
    const template = draft.template !== 'standard' && !can(user, 'premiumTemplates') ? 'standard' : draft.template

    setSaving(true)
    try {
      const payload = { ...draft, slug, template }
      const card = cardId ? await repo.cards.update(cardId, payload) : await repo.cards.create(user.id, payload)
      await repo.cards.saveSocialLinks(card.id, draft.socialLinks)
      toast.success(cardId ? 'Carte mise à jour.' : 'Votre carte est prête !')
      navigate(`/app/cartes/${card.id}`, { replace: true })
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const stepContent = useMemo(() => {
    switch (step) {
      case 0: return <StepIdentity draft={draft} update={update} errors={errors} />
      case 1: return <StepSocials draft={draft} update={update} />
      case 2: return <StepAbout draft={draft} update={update} />
      case 3: return <StepCompanies draft={draft} update={update} />
      default: return <StepDesign draft={draft} update={update} assets={assets} slugError={slugError} />
    }
  }, [step, draft, errors, assets, slugError])

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-brand-600">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <button type="button" onClick={goBack} className="rounded-xl p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-900" aria-label="Retour">
          <Icon name="arrowLeft" size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-extrabold text-ink-900 sm:text-2xl">
            {cardId ? 'Modifier ma carte' : 'Créer ma carte'}
          </h1>
          <p className="text-sm text-ink-500">
            Étape {step + 1} sur {STEPS.length} — {STEPS[step]}
          </p>
        </div>
        <Button size="sm" variant="outline" icon={showPreview ? 'eyeOff' : 'eye'} className="lg:hidden" onClick={() => setShowPreview((value) => !value)}>
          Aperçu
        </Button>
      </header>

      <Stepper steps={STEPS} current={step} onSelect={setStep} />

      {showPreview && (
        <Panel className="lg:hidden">
          <PreviewBlock draft={draft} assets={assets} />
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr,340px]">
        <div>{stepContent}</div>
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-4">
            <Panel>
              <PreviewBlock draft={draft} assets={assets} />
            </Panel>
            <Panel className="!p-4">
              <p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-ink-400">
                <Icon name="info" size={14} /> Conseil
              </p>
              <p className="text-sm leading-relaxed text-ink-600">{TIPS[step]}</p>
            </Panel>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-20 z-10 flex gap-3 rounded-2xl border border-ink-100 bg-white/95 p-3 shadow-lift backdrop-blur lg:bottom-4">
        <Button variant="outline" icon="chevronLeft" onClick={goBack} className="shrink-0">
          {step === 0 ? 'Quitter' : 'Précédent'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button full iconRight="chevronRight" onClick={goNext}>
            Continuer
          </Button>
        ) : (
          <Button full icon="check" loading={saving} onClick={save}>
            {cardId ? 'Enregistrer' : 'Créer ma carte'}
          </Button>
        )}
      </div>
    </div>
  )
}

const TIPS = [
  "Une photo lumineuse et un intitulé de profession clair suffisent à inspirer confiance.",
  "Trois à quatre réseaux bien choisis valent mieux qu'une liste complète.",
  "Écrivez comme vous parleriez à un client : une phrase, un bénéfice.",
  "Une entreprise et deux ou trois services rendent votre mini-site immédiatement utile.",
  "La carte doit rester lisible : deux couleurs, une typographie, c'est tout.",
]

function PreviewBlock({ draft, assets }) {
  return (
    <>
      <p className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-ink-400">
        <Icon name="eye" size={14} /> Aperçu en direct
      </p>
      <div className="overflow-hidden rounded-2xl shadow-soft">
        <CardScaler>
          <CardArtwork card={draft} qr={assets.qr} photoUrl={assets.photoUrl} logoUrl={assets.logoUrl} />
        </CardScaler>
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl shadow-soft">
        <CardScaler>
          <CardArtwork card={draft} side="back" qr={assets.qr} />
        </CardScaler>
      </div>
    </>
  )
}
