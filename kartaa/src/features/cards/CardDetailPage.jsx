import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, ConfirmDialog, Field, Input, Modal, Panel, SectionTitle, Spinner, Tabs, Textarea } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import { CardArtwork, CardScaler } from '../../components/card/CardArtwork'
import { useCardAssets, usePhotoEmbarquee } from '../../hooks/useCardAssets'
import { useAuth } from '../../state/AuthContext'
import { useToast } from '../../state/ToastContext'
import { repo } from '../../lib/storage'
import { exportCard } from '../../lib/cardExport'
import { copyToClipboard, downloadUrl } from '../../lib/download'
import { publicUrl } from '../../lib/slug'
import { formatDate, formatNumber } from '../../lib/format'
import { FEATURE_FLAGS, can, PRO_CAPABILITIES } from '../../config/app.config'

export default function CardDetailPage() {
  const { cardId } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [card, setCard] = useState(null)
  const [side, setSide] = useState('front')
  const [exporting, setExporting] = useState(null)
  const [domainOpen, setDomainOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const frontRef = useRef(null)
  const backRef = useRef(null)

  useEffect(() => {
    repo.cards.get(cardId).then(setCard)
    return repo.subscribe(() => repo.cards.get(cardId).then(setCard))
  }, [cardId])

  const assets = useCardAssets(card || {})
  // Les faces rendues hors écran servent au téléchargement : elles reçoivent la
  // photo déjà embarquée, pour que le fichier obtenu contienne bien l'image vue
  // à l'écran plutôt qu'un emplacement vide.
  const photoExport = usePhotoEmbarquee(assets.photoUrl)

  if (!card) {
    return (
      <div className="grid place-items-center py-24 text-brand-600">
        <Spinner size={28} />
      </div>
    )
  }

  const url = publicUrl(card.slug)

  const handleExport = async (format) => {
    setExporting(format)
    try {
      // La face exportée est celle qu'on regarde : le bouton téléchargera le
      // verso si l'onglet Verso est ouvert.
      await exportCard(card, { front: frontRef.current, back: backRef.current }, format, side)
      toast.success(
        format === 'pdf'
          ? 'Carte téléchargée en PDF, recto et verso.'
          : `${side === 'back' ? 'Verso' : 'Recto'} téléchargé en ${format.toUpperCase()}.`,
      )
    } catch (error) {
      toast.error(error.message || 'Le téléchargement a échoué. Réessayez.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link to="/app/cartes" className="rounded-xl p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-900" aria-label="Retour">
          <Icon name="arrowLeft" size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-extrabold text-ink-900 sm:text-2xl">
            {[card.profile?.firstName, card.profile?.lastName].filter(Boolean).join(' ')}
          </h1>
          <p className="truncate text-sm text-ink-500">{card.profile?.profession || 'Carte de visite numérique'}</p>
        </div>
        <Button as={Link} to={`/app/cartes/${card.id}/modifier`} size="sm" variant="outline" icon="edit">
          Modifier
        </Button>
      </header>

      <Panel>
        <Tabs
          className="mb-4 max-w-xs"
          tabs={[{ id: 'front', label: 'Recto' }, { id: 'back', label: 'Verso' }]}
          value={side}
          onChange={setSide}
        />
        <div className="overflow-hidden rounded-2xl shadow-lift">
          <CardScaler>
            <CardArtwork card={card} side={side} qr={assets.qr} photoUrl={assets.photoUrl} logoUrl={assets.logoUrl} branded={!can(user, 'removeBranding')} />
          </CardScaler>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {['png', 'jpg', 'pdf'].map((format) => (
            <Button key={format} variant="outline" icon="download" loading={exporting === format} onClick={() => handleExport(format)}>
              {format.toUpperCase()}
            </Button>
          ))}
        </div>
        <p className="hint mt-3 text-center">
          PNG et JPG téléchargent la face affichée ci-dessus — {side === 'back' ? 'le verso' : 'le recto'}. Le PDF
          contient les deux faces.
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <SectionTitle icon="qr" title="Mon QR Code" subtitle="Il ouvre votre mini-site public." />
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            {assets.qr ? (
              <img src={assets.qr} alt="QR Code de la carte" className="h-40 w-40 rounded-2xl border border-ink-100 p-2" />
            ) : (
              <div className="grid h-40 w-40 place-items-center rounded-2xl border border-ink-100">
                <Spinner />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex items-center gap-2 rounded-2xl bg-ink-50 px-3.5 py-3">
                <Icon name="link" size={16} className="shrink-0 text-ink-400" />
                <span className="truncate font-mono text-xs text-ink-700">{url}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  icon="copy"
                  onClick={async () => {
                    await copyToClipboard(url)
                    toast.success('Lien copié.')
                  }}
                >
                  Copier
                </Button>
                <Button size="sm" variant="outline" icon="download" onClick={() => assets.qr && downloadUrl(assets.qr, `qr-${card.slug}.png`)}>
                  QR Code
                </Button>
                <Button size="sm" variant="soft" icon="external" as="a" href={url} target="_blank" rel="noreferrer" className="col-span-2">
                  Voir mon mini-site
                </Button>
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <SectionTitle icon="chart" title="Activité" subtitle="Depuis la création de la carte." />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-ink-50 p-4">
              <p className="font-display text-2xl font-extrabold text-ink-900">{formatNumber(card.scans || 0)}</p>
              <p className="mt-1 text-xs font-semibold text-ink-500">Scans / visites</p>
            </div>
            <div className="rounded-2xl bg-ink-50 p-4">
              <p className="font-display text-base font-extrabold text-ink-900">{formatDate(card.createdAt)}</p>
              <p className="mt-1 text-xs font-semibold text-ink-500">Créée le</p>
            </div>
          </div>
          <Link to="/app/statistiques" className="mt-4 flex items-center justify-center gap-1.5 text-sm font-bold text-brand-600">
            Voir les statistiques détaillées <Icon name="arrowRight" size={15} />
          </Link>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Domaine personnalisé et carte physique : les deux dépendent de services
            qui ne sont pas connectés (FEATURE_FLAGS.domainRegistrar,
            FEATURE_FLAGS.physicalPrinting). Tant qu'ils ne le sont pas, ces
            entrées ne sont pas proposées — enregistrer une demande qui n'aboutit
            nulle part revient à promettre une fonctionnalité qui n'existe pas.
            Le code, les modales et les données restent en place, prêtes à
            resservir le jour où le service existe. */}
        {FEATURE_FLAGS.domainRegistrar && (
          <ActionCard
            icon="globe"
            title="Nom de domaine personnalisé"
            description={
              card.customDomain
                ? `${card.customDomain.value} — ${card.customDomain.status === 'verified' ? 'vérifié' : 'en attente de vérification'}`
                : "Remplacez l'adresse par la vôtre : www.votre-nom.com"
            }
            badge={can(user, 'customDomain') ? null : 'Pro'}
            action="Connecter mon domaine"
            onClick={() => setDomainOpen(true)}
          />
        )}

        {FEATURE_FLAGS.physicalPrinting && (
          <ActionCard
            icon="printer"
            title="Commander ma carte physique"
            description="Recevez des cartes imprimées reprenant ce design et votre QR Code."
            badge="Bientôt"
            action="Préparer ma commande"
            onClick={() => setPrintOpen(true)}
          />
        )}
      </div>

      <Panel className="border-rose-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-sm font-bold text-ink-900">Supprimer cette carte</p>
            <p className="hint mt-0.5">Le mini-site et le QR Code cesseront de fonctionner.</p>
          </div>
          <Button variant="dangerSoft" icon="trash" onClick={() => setConfirmDelete(true)}>
            Supprimer
          </Button>
        </div>
      </Panel>

      {/* Rendu hors écran, à taille réelle, utilisé pour l'export des fichiers. */}
      <div aria-hidden className="pointer-events-none fixed -left-[4000px] top-0">
        <div ref={frontRef}>
          <CardArtwork card={card} qr={assets.qr} photoUrl={photoExport} logoUrl={assets.logoUrl} />
        </div>
        <div ref={backRef}>
          <CardArtwork card={card} side="back" qr={assets.qr} photoUrl={photoExport} logoUrl={assets.logoUrl} branded={!can(user, 'removeBranding')} />
        </div>
      </div>

      <DomainModal open={domainOpen} onClose={() => setDomainOpen(false)} card={card} allowed={can(user, 'customDomain')} />
      <PrintModal open={printOpen} onClose={() => setPrintOpen(false)} card={card} />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Supprimer cette carte ?"
        description="Le QR Code imprimé ne mènera plus à rien."
        confirmLabel="Supprimer"
        onConfirm={async () => {
          await repo.cards.remove(card.id)
          toast.success('Carte supprimée.')
          navigate('/app/cartes', { replace: true })
        }}
      />
    </div>
  )
}

function ActionCard({ icon, title, description, badge, action, onClick }) {
  return (
    <Panel className="flex flex-col">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Icon name={icon} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-display text-sm font-bold text-ink-900">
            {title}
            {badge && <Badge tone="gold">{badge}</Badge>}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-500">{description}</p>
        </div>
      </div>
      <Button variant="outline" className="mt-4" onClick={onClick} iconRight="chevronRight">
        {action}
      </Button>
    </Panel>
  )
}

function DomainModal({ open, onClose, card, allowed }) {
  const [domain, setDomain] = useState(card.customDomain?.value || '')
  const toast = useToast()
  const target = `${window.location.hostname}`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connecter mon domaine"
      description="Votre mini-site répondra sur votre propre adresse."
      footer={
        <Button
          full
          disabled={!allowed || !domain.trim()}
          onClick={async () => {
            await repo.cards.update(card.id, { customDomain: { value: domain.trim(), status: 'pending', requestedAt: new Date().toISOString() } })
            toast.success('Domaine enregistré. La vérification sera activée prochainement.')
            onClose()
          }}
        >
          Enregistrer mon domaine
        </Button>
      }
    >
      {!allowed && (
        <div className="mb-5 rounded-2xl bg-gold-50 p-4">
          <div className="flex gap-3 text-sm text-gold-800">
            <Icon name="lock" size={18} className="mt-0.5 shrink-0" />
            <p>
              <strong className="font-bold">{PRO_CAPABILITIES.customDomain.label}</strong>
              {' — '}
              {PRO_CAPABILITIES.customDomain.value} Vous pouvez préparer la configuration dès maintenant.
            </p>
          </div>
          <Button as={Link} to="/app/abonnement" variant="gold" size="sm" className="mt-3">
            Voir Pro
          </Button>
        </div>
      )}
      <Field label="Votre nom de domaine" hint="Exemple : www.jean-dupont.com">
        <Input icon="globe" value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="www.votre-nom.com" />
      </Field>
      <div className="mt-5 rounded-2xl border border-ink-100 bg-ink-50 p-4">
        <p className="mb-3 font-display text-sm font-bold text-ink-900">Étapes à suivre</p>
        <ol className="space-y-3 text-sm text-ink-600">
          <li className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-xs font-extrabold text-brand-700">1</span>
            Achetez votre nom de domaine chez un hébergeur (OVH, Namecheap, Gandi…).
          </li>
          <li className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-xs font-extrabold text-brand-700">2</span>
            <span>
              Dans la zone DNS, créez un enregistrement <strong>CNAME</strong> pointant vers{' '}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-brand-700">{target}</code>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-xs font-extrabold text-brand-700">3</span>
            Revenez ici : la vérification se fera automatiquement (fonction en préparation).
          </li>
        </ol>
      </div>
      <p className="hint mt-4">
        Aucune connexion à un registrar n'est encore active : cette page enregistre votre demande et affiche la marche à
        suivre.
      </p>
    </Modal>
  )
}

function PrintModal({ open, onClose, card }) {
  const [form, setForm] = useState({ quantity: '100', address: '', note: '' })
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Commander ma carte physique"
      description="Nous préparons l'impression et la livraison. Enregistrez votre demande pour être prévenu en premier."
      footer={
        <Button
          full
          icon="check"
          loading={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await repo.cards.requestPrint(card, form)
              toast.success('Demande enregistrée. Nous vous contacterons au lancement.')
              onClose()
            } catch (erreur) {
              toast.error(erreur.message)
            } finally {
              setBusy(false)
            }
          }}
        >
          Enregistrer ma demande
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2 rounded-2xl bg-ink-50 p-4 text-sm text-ink-600">
          <p>
            Design retenu : <strong className="text-ink-900">{card.template === 'vip' ? 'VIP' : card.template === 'premium' ? 'Premium' : 'Standard'}</strong>
          </p>
          <p>
            Recto : l'identité Kartaa. Verso : votre nom et votre QR Code.
          </p>
          <p className="text-ink-500">
            Format standard 85 × 55 mm, marge de sécurité de 5 mm : rien d'important n'est coupé même si
            la découpe se décale légèrement. Le PDF téléchargé contient déjà les deux faces, dans cet ordre.
          </p>
        </div>
        <Field label="Quantité">
          <Input type="number" min="50" step="50" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
        </Field>
        <Field label="Adresse de livraison">
          <Textarea rows={3} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Quartier, ville, pays, téléphone" />
        </Field>
        <Field label="Remarque (facultatif)">
          <Input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Papier mat, coins arrondis…" />
        </Field>
        <p className="hint">
          Aucun paiement n'est demandé : l'impression sera activée dans une prochaine version, et votre
          abonnement ne change pas. La même adresse pourra être écrite sur une carte NFC, qui ouvrira le
          mini-site exactement comme le QR Code.
        </p>
      </div>
    </Modal>
  )
}
