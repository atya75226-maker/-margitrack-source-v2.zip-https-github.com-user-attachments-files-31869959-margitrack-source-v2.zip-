import { useRef, useState } from 'react'
import { Button, Field, Input, Panel } from '../../../components/ui'
import { Avatar } from '../../../components/ui'
import { Icon } from '../../../components/ui/Icons'
import { storeImage } from '../../../hooks/useImageUpload'
import { useBlobUrl } from '../../../hooks/useCardAssets'
import { initialsOf } from '../../../lib/format'
import { useToast } from '../../../state/ToastContext'

export default function StepIdentity({ draft, update, errors }) {
  const profile = draft.profile
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const photoUrl = useBlobUrl(profile.photoId)
  const toast = useToast()

  const setField = (key) => (event) => update({ profile: { ...profile, [key]: event.target.value } })

  const pickPhoto = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choisissez une image.')
      return
    }
    setBusy(true)
    try {
      const { id } = await storeImage(file, { maxSize: 800 })
      update({ profile: { ...profile, photoId: id } })
      toast.success('Photo ajoutée.')
    } catch {
      toast.error("Impossible de lire cette image.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-wrap items-center gap-5">
          <Avatar src={photoUrl} initials={initialsOf(profile.firstName, profile.lastName)} size={88} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold text-ink-900">Photo de profil</p>
            <p className="mt-1 hint">Une photo nette, cadrée sur le visage. Elle apparaît sur la carte et le mini-site.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  pickPhoto(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
              <Button size="sm" variant="outline" icon="camera" loading={busy} onClick={() => fileRef.current?.click()}>
                {profile.photoId ? 'Changer' : 'Ajouter une photo'}
              </Button>
              {profile.photoId && (
                <Button size="sm" variant="ghost" icon="trash" onClick={() => update({ profile: { ...profile, photoId: null } })}>
                  Retirer
                </Button>
              )}
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" required error={errors.firstName}>
            <Input value={profile.firstName} onChange={setField('firstName')} placeholder="Awa" />
          </Field>
          <Field label="Nom" required error={errors.lastName}>
            <Input value={profile.lastName} onChange={setField('lastName')} placeholder="Traoré" />
          </Field>
        </div>
        <Field label="Profession" hint="Elle apparaît juste sous votre nom." error={errors.profession}>
          <Input value={profile.profession} onChange={setField('profession')} placeholder="Consultante en marketing digital" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Téléphone" required error={errors.phone}>
            <Input icon="phone" value={profile.phone} onChange={setField('phone')} placeholder="+225 07 00 00 00 00" />
          </Field>
          <Field label="WhatsApp" hint="Laissez vide si identique au téléphone.">
            <Input icon="whatsapp" value={profile.whatsapp} onChange={setField('whatsapp')} placeholder="+225 07 00 00 00 00" />
          </Field>
        </div>
        <Field label="Adresse e-mail" error={errors.email}>
          <Input icon="mail" type="email" value={profile.email} onChange={setField('email')} placeholder="vous@exemple.com" />
        </Field>
        <Field label="Adresse">
          <Input icon="pin" value={profile.address} onChange={setField('address')} placeholder="Rue, quartier, immeuble…" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ville">
            <Input value={profile.city} onChange={setField('city')} placeholder="Abidjan" />
          </Field>
          <Field label="Pays">
            <Input value={profile.country} onChange={setField('country')} placeholder="Côte d'Ivoire" />
          </Field>
        </div>
      </Panel>

      <p className="flex items-start gap-2 hint">
        <Icon name="info" size={15} className="mt-0.5 shrink-0" />
        Seuls le prénom, le nom et le téléphone sont obligatoires. Tout le reste peut être complété plus tard.
      </p>
    </div>
  )
}
