import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Badge, Button, Field, Input, Modal, Panel, Progress, SectionTitle, Toggle } from '../../components/ui'
import { InstallPanel } from '../../components/InstallApp'
import {
  activerNotifications, desactiverNotifications, etatPermission,
  notificationsPrisesEnCharge, notificationsSouhaitees,
} from '../../lib/notifications'
import { Icon } from '../../components/ui/Icons'
import { publicImagePath, removeImage, uploadImage } from '../../lib/storage'
import { useAuth } from '../../state/AuthContext'
import { useData } from '../../state/DataContext'
import { useToast } from '../../state/ToastContext'
import { FEATURE_FLAGS, isPro, PRO_PRICE } from '../../config/app.config'
import { useTranslation, LANGUAGES } from '../../i18n'
import { formatBytes, initialsOf } from '../../lib/format'

export default function ProfilePage() {
  const { user, updateUser, updateAvatar, signOut } = useAuth()
  const { stats } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
  })
  const [saving, setSaving] = useState(false)
  const { t, price, language, setLanguage } = useTranslation()
  const pro = isPro(user)

  const save = async () => {
    setSaving(true)
    try {
      await updateUser(form)
      toast.success('Profil mis à jour.')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-4">
        <Avatar src={user.avatarUrl} initials={initialsOf(user.firstName, user.lastName)} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-extrabold text-ink-900">
            {user.firstName} {user.lastName}
          </h1>
          <p className="truncate text-sm text-ink-500">{user.email}</p>
        </div>
      </header>

      <PhotoDuCompte user={user} onChange={updateAvatar} />

      <Panel>
        <SectionTitle icon="user" title="Mes informations" />
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom">
              <Input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
            </Field>
            <Field label="Nom">
              <Input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
            </Field>
          </div>
          <Field label="Adresse e-mail">
            <Input icon="mail" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value.toLowerCase() })} />
          </Field>
          <Field label="Téléphone">
            <Input icon="phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </Field>
          <Button icon="check" loading={saving} onClick={save}>
            Enregistrer
          </Button>
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          icon="crown"
          title={t('sub.title')}
          action={
            <Badge tone={pro ? 'gold' : 'neutral'} icon={pro ? 'crown' : null}>
              {pro ? t('plan.pro') : t('plan.free')}
            </Badge>
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ink-50 p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-800">
              {pro ? t('sub.currentPro') : t('sub.currentFree')}
            </p>
            {!pro && (
              <p className="hint mt-0.5">
                {price(PRO_PRICE)} {t('plan.perMonth')} — {t('sub.upgradeIntro')}
              </p>
            )}
          </div>
          <Button as={Link} to="/app/abonnement" icon="crown" variant={pro ? 'outline' : 'primary'}>
            {pro ? t('sub.manage') : t('sub.cta')}
          </Button>
        </div>
      </Panel>

      <Panel>
        <SectionTitle icon="globe" title={t('lang.switch')} subtitle="Le prix reste en FCFA dans les deux langues." />
        <div className="flex gap-2">
          {LANGUAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setLanguage(item.id)}
              className={`flex-1 rounded-2xl border-2 px-4 py-3 text-sm font-bold transition-all ${
                language === item.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-100 text-ink-600'
              }`}
            >
              {item.flag} {item.label}
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <SectionTitle icon="upload" title="Stockage" subtitle="Espace occupé par vos Coffres Sécurité." />
        <Progress value={stats.quotaBytes ? (stats.usedBytes / stats.quotaBytes) * 100 : 0} tone={stats.usedBytes / stats.quotaBytes > 0.85 ? 'danger' : 'brand'} />
        <p className="mt-2 text-sm text-ink-500">
          {formatBytes(stats.usedBytes)} utilisés sur {formatBytes(stats.quotaBytes)} — {stats.files} fichier
          {stats.files > 1 ? 's' : ''} dans {stats.vaults} coffre{stats.vaults > 1 ? 's' : ''}.
        </p>
      </Panel>

      <InstallPanel />

      <PanneauNotifications />

      <Panel>
        <SectionTitle icon="info" title="À propos de ce prototype" />
        <div className="space-y-2.5 text-sm text-ink-600">
          {[
            { flag: FEATURE_FLAGS.payments, label: 'Paiement en ligne', note: "architecture prête, aucun prestataire branché" },
            { flag: FEATURE_FLAGS.physicalPrinting, label: 'Impression de cartes physiques', note: 'formulaire de commande disponible' },
            { flag: FEATURE_FLAGS.domainRegistrar, label: 'Vérification de domaine', note: 'instructions DNS affichées, vérification à venir' },
            { flag: FEATURE_FLAGS.nativeBiometrics, label: 'Biométrie (WebAuthn)', note: "active si l'appareil la propose" },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3 rounded-2xl bg-ink-50 px-4 py-3">
              <Icon name={row.flag ? 'check' : 'clock'} size={16} className={row.flag ? 'text-emerald-600' : 'text-ink-400'} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-800">{row.label}</span>
                <span className="block text-xs text-ink-400">{row.note}</span>
              </span>
              <Badge tone={row.flag ? 'success' : 'neutral'}>{row.flag ? 'Actif' : 'À venir'}</Badge>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="border-rose-100">
        <div className="space-y-3">
          <Button variant="outline" icon="logout" full onClick={async () => { await signOut(); navigate('/', { replace: true }) }}>
            Se déconnecter
          </Button>
          <p className="hint text-center">
            Vos cartes, coffres et fichiers sont hébergés sur votre projet Supabase et
            vous suivent d'un appareil à l'autre.
          </p>
        </div>
      </Panel>


    </div>
  )
}

/**
 * Préférence de notifications.
 *
 * Rien n'est envoyé aujourd'hui : ce réglage prépare « votre carte a été
 * consultée » et « votre QR Code a été scanné ». L'autorisation n'est demandée
 * qu'ici, sur un geste explicite — la réclamer au chargement de l'application
 * vaut un refus définitif, que le navigateur ne repropose jamais.
 */
function PanneauNotifications() {
  const [etat, setEtat] = useState(() => etatPermission())
  const [souhaitees, setSouhaitees] = useState(() => notificationsSouhaitees())

  if (!notificationsPrisesEnCharge()) return null

  const refusees = etat === 'denied'

  return (
    <Panel>
      <SectionTitle
        icon="bell"
        title="Notifications"
        subtitle="Être prévenu quand votre carte est consultée ou votre QR Code scanné."
      />
      <Toggle
        checked={souhaitees && etat === 'granted'}
        disabled={refusees}
        label="Recevoir les notifications"
        description={
          refusees
            ? "Votre navigateur les a bloquées pour ce site. Réactivez-les dans ses réglages, puis revenez ici."
            : "Aucune notification n'est envoyée pour l'instant : cette préférence prépare la prochaine version."
        }
        onChange={async (valeur) => {
          if (!valeur) {
            desactiverNotifications()
            setSouhaitees(false)
            return
          }
          const obtenu = await activerNotifications()
          setEtat(obtenu)
          setSouhaitees(obtenu === 'granted')
        }}
      />
    </Panel>
  )
}

/**
 * Photo du compte.
 *
 * Une seule photo pour tout le produit : l'application la montre en haut, le
 * mini-site l'affiche, et les cartes la reprennent automatiquement tant qu'on
 * ne leur en a pas donné une autre. C'est ce qui manquait : la photo venue de
 * Google ne pouvait être ni changée ni remplacée, et rien ne permettait d'en
 * ajouter une sans passer par une carte.
 */
function PhotoDuCompte({ user, onChange }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const photo = user.avatarUrl || ''

  const choisir = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choisissez une image.')
      return
    }
    setBusy(true)
    try {
      const { url } = await uploadImage(file, { maxSize: 700 })
      // L'ancienne image n'est supprimée qu'une fois la nouvelle enregistrée :
      // un échec en cours de route laisse le compte avec une photo, jamais sans.
      const ancien = publicImagePath(photo)
      await onChange(url)
      if (ancien) await removeImage(ancien)
      toast.success('Photo mise à jour. Vos cartes l\u2019utilisent déjà.')
    } catch (error) {
      toast.error(error.message || "Impossible d'envoyer cette image.")
    } finally {
      setBusy(false)
    }
  }

  const retirer = async () => {
    setBusy(true)
    try {
      const ancien = publicImagePath(photo)
      await onChange('')
      if (ancien) await removeImage(ancien)
      toast.success('Photo retirée.')
    } catch (error) {
      toast.error(error.message || 'Suppression impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel>
      <SectionTitle icon="camera" title="Ma photo" />
      <div className="flex flex-wrap items-center gap-5">
        <Avatar src={photo} initials={initialsOf(user.firstName, user.lastName)} size={80} />
        <div className="min-w-0 flex-1">
          <p className="hint">
            Elle apparaît sur vos cartes et sur votre mini-site public. Sans photo, ce sont vos initiales
            qui s'affichent.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              choisir(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" icon="camera" loading={busy} onClick={() => fileRef.current?.click()}>
              {photo ? 'Changer ma photo' : 'Ajouter une photo'}
            </Button>
            {photo && (
              <Button size="sm" variant="ghost" icon="trash" disabled={busy} onClick={retirer}>
                Retirer
              </Button>
            )}
          </div>
        </div>
      </div>
    </Panel>
  )
}
