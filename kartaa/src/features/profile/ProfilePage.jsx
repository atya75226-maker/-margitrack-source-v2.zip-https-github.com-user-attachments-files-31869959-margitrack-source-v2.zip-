import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Badge, Button, ConfirmDialog, Field, Input, Modal, Panel, Progress, SectionTitle } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import { useAuth } from '../../state/AuthContext'
import { useData } from '../../state/DataContext'
import { useToast } from '../../state/ToastContext'
import { FEATURE_FLAGS, PLANS, PLAN_ORDER, planOf } from '../../config/app.config'
import { repo } from '../../lib/storage'
import { formatBytes, initialsOf } from '../../lib/format'

export default function ProfilePage() {
  const { user, updateUser, signOut } = useAuth()
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
  const [planModal, setPlanModal] = useState(null)
  const [resetOpen, setResetOpen] = useState(false)
  const plan = planOf(user)

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
      <header className="flex items-center gap-4">
        <Avatar initials={initialsOf(user.firstName, user.lastName)} size={64} />
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-extrabold text-ink-900">
            {user.firstName} {user.lastName}
          </h1>
          <p className="truncate text-sm text-ink-500">{user.email}</p>
        </div>
      </header>

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
          title="Mon offre"
          subtitle="Les paiements ne sont pas encore activés : vous pouvez essayer chaque niveau."
          action={<Badge tone={plan.id === 'free' ? 'neutral' : 'gold'}>{plan.name}</Badge>}
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const item = PLANS[id]
            const active = plan.id === id
            return (
              <div
                key={id}
                className={`flex flex-col rounded-3xl border-2 p-5 ${active ? 'border-brand-600 bg-brand-50/40' : 'border-ink-100'}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-display text-base font-bold text-ink-900">{item.name}</p>
                  {active && <Icon name="check" size={18} className="text-brand-600" />}
                </div>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="font-display text-2xl font-extrabold text-ink-900">{item.price}</span>
                  <span className="text-xs font-semibold text-ink-400">{item.currency || ''} {item.period}</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2">
                  {item.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-ink-600">
                      <Icon name="check" size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-4"
                  size="sm"
                  full
                  variant={active ? 'outline' : id === 'free' ? 'outline' : 'dark'}
                  disabled={active}
                  onClick={() => setPlanModal(item)}
                >
                  {active ? 'Offre actuelle' : `Passer en ${item.name}`}
                </Button>
              </div>
            )
          })}
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
          <Button variant="outline" icon="logout" full onClick={() => { signOut(); navigate('/', { replace: true }) }}>
            Se déconnecter
          </Button>
          <Button variant="dangerSoft" icon="trash" full onClick={() => setResetOpen(true)}>
            Effacer toutes les données du prototype
          </Button>
          <p className="hint text-center">
            Les données du prototype sont enregistrées sur cet appareil uniquement.
          </p>
        </div>
      </Panel>

      <Modal
        open={!!planModal}
        onClose={() => setPlanModal(null)}
        title={`Passer en ${planModal?.name || ''}`}
        description="Le paiement n'est pas encore branché : l'offre est activée en mode démonstration."
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" full onClick={() => setPlanModal(null)}>
              Annuler
            </Button>
            <Button
              full
              onClick={async () => {
                await updateUser({ plan: planModal.id })
                toast.success(`Offre ${planModal.name} activée (démonstration).`)
                setPlanModal(null)
              }}
            >
              Activer
            </Button>
          </div>
        }
      >
        <ul className="space-y-2">
          {(planModal?.features || []).map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-ink-600">
              <Icon name="check" size={15} className="mt-0.5 shrink-0 text-emerald-600" />
              {feature}
            </li>
          ))}
        </ul>
      </Modal>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Effacer toutes les données ?"
        description="Comptes, cartes, coffres et fichiers seront supprimés de cet appareil."
        confirmLabel="Tout effacer"
        onConfirm={async () => {
          await repo.resetEverything()
          signOut()
          navigate('/', { replace: true })
        }}
      />
    </div>
  )
}
