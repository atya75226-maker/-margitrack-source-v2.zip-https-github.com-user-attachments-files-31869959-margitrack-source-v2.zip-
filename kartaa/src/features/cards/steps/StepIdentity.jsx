import { useRef, useState } from 'react'
import { Button, Field, Input, Panel } from '../../../components/ui'
import { Avatar } from '../../../components/ui'
import { Icon } from '../../../components/ui/Icons'
import { uploadImage, removeImage } from '../../../lib/storage'
import { Button as Bouton } from '../../../components/ui'
import { initialsOf } from '../../../lib/format'
import { useToast } from '../../../state/ToastContext'
import { useAuth } from '../../../state/AuthContext'

export default function StepIdentity({ draft, update, errors }) {
  const profile = draft.profile
  const fileRef = useRef(null)
  const logoRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [busyLogo, setBusyLogo] = useState(false)
  const toast = useToast()
  const { user } = useAuth()
  // Par défaut, la carte reprend la photo du compte : personne n'a à la redonner.
  // Celle choisie ici ne sert qu'à en mettre une autre sur cette carte précise.
  const photoDuCompte = user?.avatarUrl || null
  const photoPropre = profile.photoUrl || null
  const photoAffichee = photoPropre || photoDuCompte

  const setField = (key) => (event) => update({ profile: { ...profile, [key]: event.target.value } })

  const pickPhoto = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choisissez une image.')
      return
    }
    setBusy(true)
    try {
      const { path, url } = await uploadImage(file, { maxSize: 800 })
      if (profile.photoPath) await removeImage(profile.photoPath)
      update({ profile: { ...profile, photoUrl: url, photoPath: path } })
      toast.success('Photo ajoutée.')
    } catch (error) {
      toast.error(error.message || "Impossible d'envoyer cette image.")
    } finally {
      setBusy(false)
    }
  }

  const choisirLogo = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choisissez une image.')
      return
    }
    setBusyLogo(true)
    try {
      const { path, url } = await uploadImage(file, { maxSize: 600 })
      const ancien = profile.logoPath
      update({ profile: { ...profile, logoUrl: url, logoPath: path } })
      if (ancien) await removeImage(ancien)
      toast.success('Logo ajouté.')
    } catch (error) {
      toast.error(error.message || "Impossible d'envoyer ce logo.")
    } finally {
      setBusyLogo(false)
    }
  }

  const retirerLogo = async () => {
    const ancien = profile.logoPath
    update({ profile: { ...profile, logoUrl: null, logoPath: null } })
    if (ancien) await removeImage(ancien)
    toast.success('Logo retiré.')
  }

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-wrap items-center gap-5">
          <Avatar src={photoAffichee} initials={initialsOf(profile.firstName, profile.lastName)} size={88} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold text-ink-900">Photo</p>
            <p className="mt-1 hint">
              {photoPropre
                ? 'Cette carte utilise une photo qui lui est propre. La retirer fait revenir celle de votre compte.'
                : photoDuCompte
                  ? 'La photo de votre compte est utilisée. Vous pouvez en choisir une autre pour cette carte seulement.'
                  : 'Une photo nette, cadrée sur le visage. Elle apparaît sur la carte et le mini-site.'}
            </p>
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
                {photoPropre ? 'Changer' : photoDuCompte ? 'Une autre photo pour cette carte' : 'Ajouter une photo'}
              </Button>
              {profile.photoUrl && (
                <Button size="sm" variant="ghost" icon="trash" onClick={async () => {
                  await removeImage(profile.photoPath)
                  update({ profile: { ...profile, photoUrl: null, photoPath: null } })
                }}>
                  Retirer
                </Button>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {/* Le logo est indépendant de la photo : l'un, l'autre, les deux, ou aucun.
          Aucun logo n'est imposé — ni celui de Kartaa, ni un autre. */}
      <Panel>
        <div className="flex flex-wrap items-center gap-5">
          <span className="grid h-[88px] w-[88px] shrink-0 place-items-center overflow-hidden rounded-3xl border border-ink-100 bg-ink-50 text-ink-300">
            {profile.logoUrl
              ? <img src={profile.logoUrl} alt="" className="h-full w-full object-contain p-2" />
              : <Icon name="image" size={26} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold text-ink-900">Votre logo</p>
            <p className="mt-1 hint">
              Facultatif, et indépendant de votre photo. Il apparaît sur votre carte et sur votre
              mini-site. Sans logo, la carte reste parfaitement lisible.
            </p>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                choisirLogo(event.target.files?.[0])
                event.target.value = ''
              }}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Bouton size="sm" variant="outline" icon="image" loading={busyLogo} onClick={() => logoRef.current?.click()}>
                {profile.logoUrl ? 'Changer de logo' : 'Ajouter un logo'}
              </Bouton>
              {profile.logoUrl && (
                <Bouton size="sm" variant="ghost" icon="trash" disabled={busyLogo} onClick={retirerLogo}>
                  Retirer
                </Bouton>
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
