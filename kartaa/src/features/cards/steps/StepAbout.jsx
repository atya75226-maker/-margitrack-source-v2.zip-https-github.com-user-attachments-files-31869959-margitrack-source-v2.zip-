import { useState } from 'react'
import { Button, Field, Input, Panel, Textarea } from '../../../components/ui'
import { Icon } from '../../../components/ui/Icons'

const SUGGESTIONS = ['Marketing digital', 'Création de sites web', 'Formation', 'Conseil', 'Photographie', 'Import-export']

export default function StepAbout({ draft, update }) {
  const [activity, setActivity] = useState('')
  const activities = draft.activities || []

  const addActivity = (value) => {
    const clean = (value || '').trim()
    if (!clean || activities.includes(clean)) return
    update({ activities: [...activities, clean] })
    setActivity('')
  }

  return (
    <div className="space-y-5">
      <Panel>
        <Field
          label="À propos de moi"
          hint={`${(draft.about || '').length}/400 caractères — une présentation courte et concrète.`}
        >
          <Textarea
            value={draft.about || ''}
            maxLength={400}
            rows={5}
            onChange={(event) => update({ about: event.target.value })}
            placeholder="Entrepreneur spécialisé dans le digital et l'accompagnement des petites entreprises."
          />
        </Field>
      </Panel>

      <Panel>
        <p className="field-label">Mes activités</p>
        <p className="mb-3 hint">Ajoutez les domaines dans lesquels vous intervenez. Ils apparaissent sur votre mini-site.</p>
        <div className="flex gap-2">
          <Input
            value={activity}
            onChange={(event) => setActivity(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addActivity(activity)
              }
            }}
            placeholder="Marketing digital"
          />
          <Button icon="plus" onClick={() => addActivity(activity)}>
            Ajouter
          </Button>
        </div>

        {!!activities.length && (
          <div className="mt-4 flex flex-wrap gap-2">
            {activities.map((item) => (
              <span key={item} className="flex items-center gap-2 rounded-full bg-brand-50 py-1.5 pl-4 pr-2 text-sm font-semibold text-brand-700">
                {item}
                <button
                  type="button"
                  onClick={() => update({ activities: activities.filter((value) => value !== item) })}
                  className="grid h-5 w-5 place-items-center rounded-full bg-brand-100 hover:bg-brand-200"
                  aria-label={`Retirer ${item}`}
                >
                  <Icon name="x" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 border-t border-ink-100 pt-4">
          <p className="hint mb-2">Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.filter((item) => !activities.includes(item)).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => addActivity(item)}
                className="rounded-full border border-ink-200 px-3.5 py-1.5 text-xs font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700"
              >
                + {item}
              </button>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  )
}
