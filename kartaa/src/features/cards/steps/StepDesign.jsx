import { Badge, Field, Input, Panel } from '../../../components/ui'
import { Icon } from '../../../components/ui/Icons'
import { FONTS, PALETTES, TEMPLATES, planOf } from '../../../config/app.config'
import { CardArtwork, CardScaler } from '../../../components/card/CardArtwork'
import { useAuth } from '../../../state/AuthContext'
import { slugify } from '../../../lib/slug'
import { APP } from '../../../config/app.config'

export default function StepDesign({ draft, update, assets, slugError }) {
  const { user } = useAuth()
  const allowed = planOf(user).limits.templates

  return (
    <div className="space-y-5">
      <Panel>
        <p className="font-display text-base font-bold text-ink-900">Modèle de carte</p>
        <p className="hint mt-0.5 mb-4">Le contenu reste le même : seul le niveau de finition change.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {TEMPLATES.map((template) => {
            const locked = !allowed.includes(template.id)
            const active = draft.template === template.id
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => !locked && update({ template: template.id, theme: { ...draft.theme, ...template.defaults, primary: draft.theme?.primary || template.defaults.primary } })}
                className={`overflow-hidden rounded-3xl border-2 text-left transition-all ${
                  active ? 'border-brand-600 shadow-lift' : 'border-ink-100 hover:border-ink-300'
                } ${locked ? 'opacity-70' : ''}`}
              >
                <div className="relative bg-ink-100">
                  <CardScaler>
                    <CardArtwork card={{ ...draft, template: template.id, theme: { ...draft.theme, ...template.defaults } }} qr={assets.qr} photoUrl={assets.photoUrl} logoUrl={assets.logoUrl} />
                  </CardScaler>
                  {locked && (
                    <span className="absolute inset-0 grid place-items-center bg-ink-950/50 text-white">
                      <span className="flex items-center gap-1.5 rounded-full bg-gold-400 px-3 py-1.5 text-xs font-extrabold text-ink-900">
                        <Icon name="crown" size={13} /> Offre {template.plan === 'vip' ? 'VIP' : 'Premium'}
                      </span>
                    </span>
                  )}
                </div>
                <div className="flex items-start justify-between gap-2 p-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-bold text-ink-900">{template.name}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{template.description}</p>
                  </div>
                  {active && <Icon name="check" size={18} className="mt-0.5 shrink-0 text-brand-600" />}
                </div>
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel>
        <p className="font-display text-base font-bold text-ink-900">Couleurs</p>
        <p className="hint mt-0.5 mb-4">Une couleur principale, un accent. On reste sobre : c'est une carte professionnelle.</p>
        <div className="flex flex-wrap gap-2.5">
          {PALETTES.map((palette) => {
            const active = draft.theme?.primary === palette.primary
            return (
              <button
                key={palette.name}
                type="button"
                onClick={() => update({ theme: { ...draft.theme, primary: palette.primary, accent: palette.accent } })}
                className={`flex items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2.5 transition-all ${
                  active ? 'border-brand-600 bg-brand-50' : 'border-ink-100 hover:border-ink-300'
                }`}
              >
                <span className="flex">
                  <span className="h-6 w-6 rounded-full border-2 border-white" style={{ background: palette.primary }} />
                  <span className="-ml-2.5 h-6 w-6 rounded-full border-2 border-white" style={{ background: palette.accent }} />
                </span>
                <span className="text-sm font-bold text-ink-700">{palette.name}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Couleur principale">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={draft.theme?.primary || '#6d28d9'}
                onChange={(event) => update({ theme: { ...draft.theme, primary: event.target.value } })}
                className="h-11 w-14 cursor-pointer rounded-xl border border-ink-200 bg-white p-1"
              />
              <Input value={draft.theme?.primary || ''} onChange={(event) => update({ theme: { ...draft.theme, primary: event.target.value } })} />
            </div>
          </Field>
          <Field label="Couleur d'accent">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={draft.theme?.accent || '#f5b229'}
                onChange={(event) => update({ theme: { ...draft.theme, accent: event.target.value } })}
                className="h-11 w-14 cursor-pointer rounded-xl border border-ink-200 bg-white p-1"
              />
              <Input value={draft.theme?.accent || ''} onChange={(event) => update({ theme: { ...draft.theme, accent: event.target.value } })} />
            </div>
          </Field>
        </div>
      </Panel>

      <Panel>
        <p className="font-display text-base font-bold text-ink-900">Typographie</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {FONTS.map((font) => (
            <button
              key={font.id}
              type="button"
              onClick={() => update({ theme: { ...draft.theme, font: font.id } })}
              className={`rounded-2xl border-2 px-4 py-4 text-center transition-all ${
                draft.theme?.font === font.id ? 'border-brand-600 bg-brand-50' : 'border-ink-100 hover:border-ink-300'
              }`}
            >
              <span className={`block text-xl font-bold text-ink-900 ${font.className}`}>Aa</span>
              <span className="mt-1 block text-xs font-bold text-ink-500">{font.label}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <Field
          label="Adresse de mon mini-site"
          error={slugError}
          hint="C'est l'adresse que votre QR Code ouvrira. Choisissez-la courte et facile à dicter."
        >
          <div className="flex items-center gap-2">
            <span className="hidden shrink-0 rounded-2xl bg-ink-100 px-3.5 py-3 text-sm font-semibold text-ink-500 sm:block">
              {APP.publicDomain}/
            </span>
            <Input value={draft.slug} onChange={(event) => update({ slug: slugify(event.target.value) })} placeholder="jean-dupont" />
          </div>
        </Field>
        <div className="mt-3 flex items-center gap-2">
          <Badge tone="brand" icon="qr">QR Code généré automatiquement</Badge>
          <Badge tone="neutral" icon="link">Modifiable plus tard</Badge>
        </div>
      </Panel>
    </div>
  )
}
