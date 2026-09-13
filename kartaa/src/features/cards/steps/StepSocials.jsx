import { Field, Input, Panel, Toggle } from '../../../components/ui'
import { SocialIcon } from '../../../components/ui/Icons'
import { SOCIAL_NETWORKS } from '../../../config/app.config'

export default function StepSocials({ draft, update }) {
  const socials = draft.socials || []

  const entryOf = (key) => socials.find((item) => item.key === key) || { key, value: '', enabled: false }

  const setEntry = (key, patch) => {
    const next = socials.some((item) => item.key === key)
      ? socials.map((item) => (item.key === key ? { ...item, ...patch } : item))
      : [...socials, { key, value: '', enabled: false, ...patch }]
    update({ socials: next })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-500">
        Activez uniquement les réseaux que vous souhaitez afficher. Chaque réseau activé devient un bouton sur votre
        mini-site.
      </p>
      {SOCIAL_NETWORKS.map((network) => {
        const entry = entryOf(network.key)
        return (
          <Panel key={network.key} className="!p-4">
            <div className="flex items-center gap-3.5">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
                style={{ background: entry.enabled ? network.color : '#cbcfe0' }}
              >
                <SocialIcon network={network.key} size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <Toggle
                  checked={entry.enabled}
                  onChange={(checked) => setEntry(network.key, { enabled: checked })}
                  label={network.label}
                  description={entry.enabled ? null : 'Désactivé'}
                />
              </div>
            </div>
            {entry.enabled && (
              <Field className="mt-4">
                <Input
                  value={entry.value}
                  onChange={(event) => setEntry(network.key, { value: event.target.value })}
                  placeholder={network.placeholder}
                  inputMode={network.kind === 'phone' ? 'tel' : 'url'}
                />
              </Field>
            )}
          </Panel>
        )
      })}
    </div>
  )
}
