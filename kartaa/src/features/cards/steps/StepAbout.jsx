import { useRef, useState } from 'react'
import { Button, Field, Input, Panel, Textarea, EmptyState } from '../../../components/ui'
import { Icon } from '../../../components/ui/Icons'
import { uploadImage, removeImage } from '../../../lib/storage'
import { useProLock, ProBadge } from '../../../components/ProLock'
import { useAuth } from '../../../state/AuthContext'
import { can } from '../../../config/app.config'
import { randomId } from '../../../lib/crypto'

const GALERIE_MAX = 12

const SUGGESTIONS = ['Marketing digital', 'Création de sites web', 'Formation', 'Conseil', 'Photographie', 'Import-export']

export default function StepAbout({ draft, update }) {
  const [activity, setActivity] = useState('')
  const { user } = useAuth()
  const { requirePro } = useProLock()
  const activities = draft.activities || []
  const gallery = draft.gallery || []
  const plusieursActivites = can(user, 'multipleActivities')

  const addActivity = (value) => {
    const clean = (value || '').trim()
    if (!clean || activities.includes(clean)) return
    // Une activité pour tout le monde ; au-delà, c'est l'abonnement Pro. La base
    // applique la même règle : ce verrou est un raccourci, pas la protection.
    if (activities.length >= 1 && !requirePro('multipleActivities')) return
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

      <Galerie
        photos={gallery}
        autorisee={can(user, 'gallery')}
        onDemande={() => requirePro('gallery')}
        onChange={(photos) => update({ gallery: photos })}
      />
    </div>
  )
}

/**
 * Galerie du mini-site : quelques photos de réalisations, de produits ou de
 * lieu. Les images partent dans l'espace public des cartes, comme la photo de
 * profil et les logos — elles s'affichent pour un visiteur non connecté. Rien
 * de privé n'a sa place ici : c'est le Coffre Sécurité qui sert à cela.
 */
function Galerie({ photos, onChange, autorisee = true, onDemande }) {
  const champ = useRef(null)
  const [busy, setBusy] = useState(false)

  const ajouter = async (fichiers) => {
    const restants = GALERIE_MAX - photos.length
    if (restants <= 0) return
    setBusy(true)
    try {
      const ajoutees = []
      for (const fichier of Array.from(fichiers).slice(0, restants)) {
        // Une par une : téléverser en parallèle sature les connexions lentes.
        const envoyee = await uploadImage(fichier, { maxSize: 1400 })
        ajoutees.push({ id: randomId('img'), url: envoyee.url, path: envoyee.path, caption: '' })
      }
      onChange([...photos, ...ajoutees])
    } finally {
      setBusy(false)
    }
  }

  const retirer = async (photo) => {
    onChange(photos.filter((item) => item.id !== photo.id))
    await removeImage(photo.path)
  }

  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-display text-base font-bold text-ink-900">
            Ma galerie
            {!autorisee && <ProBadge />}
          </p>
          <p className="hint mt-0.5">
            Vos réalisations, vos produits, votre local. Jusqu'à {GALERIE_MAX} photos, visibles sur votre
            mini-site.
          </p>
        </div>
        {autorisee ? (
          <Button
            size="sm"
            variant="outline"
            icon="plus"
            loading={busy}
            disabled={photos.length >= GALERIE_MAX}
            onClick={() => champ.current?.click()}
          >
            Ajouter
          </Button>
        ) : (
          <Button size="sm" variant="outline" icon="lock" onClick={onDemande}>
            Voir Pro
          </Button>
        )}
      </div>

      <input
        ref={champ}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const fichiers = event.target.files
          event.target.value = ''
          if (fichiers?.length) ajouter(fichiers)
        }}
      />

      {photos.length ? (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-2xl bg-ink-100">
              <img src={photo.url} alt={photo.caption || ''} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => retirer(photo)}
                aria-label="Retirer cette photo"
                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg bg-ink-900/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="image"
          title="Aucune photo"
          description="Une galerie donne du crédit à une carte : montrez ce que vous faites."
          className="!py-8"
        />
      )}
    </Panel>
  )
}
