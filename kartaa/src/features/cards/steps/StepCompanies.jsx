import { useRef, useState } from 'react'
import { Button, Field, Input, Modal, Panel, Textarea, EmptyState } from '../../../components/ui'
import { Icon, SocialIcon } from '../../../components/ui/Icons'
import { SOCIAL_NETWORKS } from '../../../config/app.config'
import { uploadImage, removeImage } from '../../../lib/storage'
import { randomId } from '../../../lib/crypto'
import { useProLock, ProBadge } from '../../../components/ProLock'
import { useAuth } from '../../../state/AuthContext'
import { can } from '../../../config/app.config'

const EMPTY_COMPANY = {
  name: '', description: '', phone: '', whatsapp: '', address: '', website: '',
  logoUrl: null, logoPath: null, socials: [],
}
const EMPTY_SERVICE = { name: '', description: '', price: '', photoUrl: null, photoPath: null }

export default function StepCompanies({ draft, update }) {
  const [companyDraft, setCompanyDraft] = useState(null)
  const [serviceDraft, setServiceDraft] = useState(null)
  const { user } = useAuth()
  const { requirePro } = useProLock()
  const companies = draft.companies || []
  const services = draft.services || []
  // Une entreprise pour tout le monde ; la suivante est incluse dans Pro. Les
  // services, eux, restent libres : c'est le cœur d'une carte professionnelle.
  const plusieursEntreprises = can(user, 'multipleCompanies')

  const saveCompany = () => {
    const value = { ...companyDraft, name: companyDraft.name.trim() }
    if (!value.name) return
    const next = companies.some((item) => item.id === value.id)
      ? companies.map((item) => (item.id === value.id ? value : item))
      : [...companies, value]
    update({ companies: next })
    setCompanyDraft(null)
  }

  const saveService = () => {
    const value = { ...serviceDraft, name: serviceDraft.name.trim() }
    if (!value.name) return
    const next = services.some((item) => item.id === value.id)
      ? services.map((item) => (item.id === value.id ? value : item))
      : [...services, value]
    update({ services: next })
    setServiceDraft(null)
  }

  return (
    <div className="space-y-5">
      <Panel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-display text-base font-bold text-ink-900">
              Mes entreprises
              {companies.length >= 1 && !plusieursEntreprises && <ProBadge />}
            </p>
            <p className="hint mt-0.5">
              {plusieursEntreprises
                ? 'Ajoutez une ou plusieurs structures. La première apparaît sur la carte.'
                : 'Une structure sur l’offre Gratuit. La suivante est incluse dans Pro.'}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            icon={companies.length >= 1 && !plusieursEntreprises ? 'lock' : 'plus'}
            onClick={() => {
              if (companies.length >= 1 && !requirePro('multipleCompanies')) return
              setCompanyDraft({ ...EMPTY_COMPANY, id: randomId('cmp') })
            }}
          >
            {companies.length >= 1 && !plusieursEntreprises ? 'Voir Pro' : 'Ajouter'}
          </Button>
        </div>
        {companies.length ? (
          <div className="space-y-3">
            {companies.map((company) => (
              <CompanyRow
                key={company.id}
                company={company}
                onEdit={() => setCompanyDraft(company)}
                onRemove={() => update({ companies: companies.filter((item) => item.id !== company.id) })}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon="briefcase" title="Aucune entreprise" description="Facultatif : vous pouvez présenter une carte purement personnelle." className="!py-8" />
        )}
      </Panel>

      <Panel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-base font-bold text-ink-900">Mes services</p>
            <p className="hint mt-0.5">Nom, description, prix et photo — le prix et la photo sont facultatifs.</p>
          </div>
          <Button size="sm" variant="outline" icon="plus" onClick={() => setServiceDraft({ ...EMPTY_SERVICE, id: randomId('srv') })}>
            Ajouter
          </Button>
        </div>
        {services.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                onEdit={() => setServiceDraft(service)}
                onRemove={() => update({ services: services.filter((item) => item.id !== service.id) })}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon="sparkles" title="Aucun service" description="Présentez ce que vous proposez pour donner envie de vous contacter." className="!py-8" />
        )}
      </Panel>

      <CompanyModal draft={companyDraft} setDraft={setCompanyDraft} onSave={saveCompany} />
      <ServiceModal draft={serviceDraft} setDraft={setServiceDraft} onSave={saveService} />
    </div>
  )
}

function CompanyRow({ company, onEdit, onRemove }) {
  const logoUrl = company.logoUrl
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-ink-100 p-3.5">
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-ink-100 text-ink-500">
        {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : <Icon name="briefcase" size={20} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink-900">{company.name}</p>
        <p className="truncate text-xs text-ink-400">{company.description || company.website || 'Aucune description'}</p>
      </div>
      <button type="button" onClick={onEdit} className="rounded-xl p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-800" aria-label="Modifier">
        <Icon name="edit" size={17} />
      </button>
      <button type="button" onClick={onRemove} className="rounded-xl p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Supprimer">
        <Icon name="trash" size={17} />
      </button>
    </div>
  )
}

function ServiceRow({ service, onEdit, onRemove }) {
  const photoUrl = service.photoUrl
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-100">
      {photoUrl && <img src={photoUrl} alt="" className="h-28 w-full object-cover" />}
      <div className="flex items-start gap-2 p-3.5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink-900">{service.name}</p>
          {service.description && <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{service.description}</p>}
          {service.price && <p className="mt-1.5 text-sm font-bold text-brand-700">{service.price}</p>}
        </div>
        <button type="button" onClick={onEdit} className="rounded-xl p-2 text-ink-400 hover:bg-ink-100" aria-label="Modifier">
          <Icon name="edit" size={16} />
        </button>
        <button type="button" onClick={onRemove} className="rounded-xl p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Supprimer">
          <Icon name="trash" size={16} />
        </button>
      </div>
    </div>
  )
}

function LogoPicker({ url, path, onChange, label = 'Logo', maxSize = 512 }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex items-center gap-4">
      <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-ink-100 text-ink-400">
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Icon name="image" size={22} />}
      </span>
      <div>
        <p className="text-sm font-semibold text-ink-800">{label}</p>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            setBusy(true)
            try {
              const uploaded = await uploadImage(file, { maxSize })
              if (path) await removeImage(path)
              onChange(uploaded)
            } finally {
              setBusy(false)
            }
          }}
        />
        <div className="mt-1.5 flex gap-2">
          <Button size="sm" variant="outline" loading={busy} onClick={() => ref.current?.click()}>
            {url ? 'Changer' : 'Choisir'}
          </Button>
          {url && (
            <Button size="sm" variant="ghost" onClick={async () => {
              await removeImage(path)
              onChange(null)
            }}>
              Retirer
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function CompanyModal({ draft, setDraft, onSave }) {
  if (!draft) return null
  const set = (key) => (event) => setDraft({ ...draft, [key]: event.target.value })
  const socials = draft.socials || []
  const toggleSocial = (key, value) => {
    const next = socials.some((item) => item.key === key)
      ? socials.map((item) => (item.key === key ? { ...item, value } : item))
      : [...socials, { key, value, enabled: true }]
    setDraft({ ...draft, socials: next.filter((item) => item.value) })
  }
  return (
    <Modal
      open
      onClose={() => setDraft(null)}
      title="Entreprise"
      description="Ces informations apparaissent dans la section Entreprises de votre mini-site."
      footer={
        <div className="flex gap-3">
          <Button variant="outline" full onClick={() => setDraft(null)}>
            Annuler
          </Button>
          <Button full onClick={onSave} disabled={!draft.name.trim()}>
            Enregistrer
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <LogoPicker
          url={draft.logoUrl}
          path={draft.logoPath}
          onChange={(image) => setDraft({ ...draft, logoUrl: image?.url || null, logoPath: image?.path || null })}
        />
        <Field label="Nom de l'entreprise" required>
          <Input value={draft.name} onChange={set('name')} placeholder="Studio Akwaba" />
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={draft.description} onChange={set('description')} placeholder="Agence de communication digitale basée à Abidjan." />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Téléphone">
            <Input icon="phone" value={draft.phone} onChange={set('phone')} />
          </Field>
          <Field label="WhatsApp">
            <Input icon="whatsapp" value={draft.whatsapp} onChange={set('whatsapp')} />
          </Field>
        </div>
        <Field label="Adresse">
          <Input icon="pin" value={draft.address} onChange={set('address')} />
        </Field>
        <Field label="Site web">
          <Input icon="globe" value={draft.website} onChange={set('website')} placeholder="studio-akwaba.ci" />
        </Field>
        <div>
          <p className="field-label">Réseaux sociaux de l'entreprise</p>
          <div className="space-y-2.5">
            {SOCIAL_NETWORKS.filter((network) => network.key !== 'whatsapp').map((network) => (
              <div key={network.key} className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-500">
                  <SocialIcon network={network.key} size={17} />
                </span>
                <Input
                  value={socials.find((item) => item.key === network.key)?.value || ''}
                  onChange={(event) => toggleSocial(network.key, event.target.value)}
                  placeholder={network.placeholder}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ServiceModal({ draft, setDraft, onSave }) {
  if (!draft) return null
  const set = (key) => (event) => setDraft({ ...draft, [key]: event.target.value })
  return (
    <Modal
      open
      onClose={() => setDraft(null)}
      title="Service"
      footer={
        <div className="flex gap-3">
          <Button variant="outline" full onClick={() => setDraft(null)}>
            Annuler
          </Button>
          <Button full onClick={onSave} disabled={!draft.name.trim()}>
            Enregistrer
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <LogoPicker
          url={draft.photoUrl}
          path={draft.photoPath}
          onChange={(image) => setDraft({ ...draft, photoUrl: image?.url || null, photoPath: image?.path || null })}
          label="Photo (facultative)"
          maxSize={900}
        />
        <Field label="Nom du service" required>
          <Input value={draft.name} onChange={set('name')} placeholder="Création de site web" />
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={draft.description} onChange={set('description')} placeholder="Site vitrine responsive livré en deux semaines." />
        </Field>
        <Field label="Prix (facultatif)" hint="Texte libre : « À partir de 150 000 FCFA », « Sur devis »…">
          <Input value={draft.price} onChange={set('price')} placeholder="À partir de 150 000 FCFA" />
        </Field>
      </div>
    </Modal>
  )
}
