import { Button, Field, Input, Panel } from '../../../components/ui'
import { Icon, SocialIcon } from '../../../components/ui/Icons'
import { SOCIAL_NETWORKS, isPro, formatPrice } from '../../../config/app.config'
import { useProLock } from '../../../components/ProLock'
import { useAuth } from '../../../state/AuthContext'

/**
 * Réseaux et liens : autant de comptes que souhaité par plateforme.
 *
 * Le tableau `socialLinks` est la seule source de vérité. Chaque ligne vide est
 * simplement ignorée à l'enregistrement, ce qui permet d'afficher un premier
 * champ pour chaque plateforme sans forcer l'utilisateur à le remplir.
 *
 * QUATRE RÉSEAUX SONT INCLUS DANS L'ABONNEMENT PRO
 *
 * Facebook, TikTok, YouTube et Telegram (`pro: true` dans la configuration).
 * Les coordonnées de base — téléphone, WhatsApp, e-mail — et tous les autres
 * liens restent gratuits : une carte gratuite doit rester une vraie carte.
 *
 * Ce que l'écran fait ici n'est qu'une courtoisie. Le refus réel vient de
 * set_card_social_links(), qui compare le plan EFFECTIF du propriétaire et
 * rejette toute adresse nouvelle sur ces quatre plateformes.
 *
 * UN ABONNEMENT QUI PREND FIN NE FAIT RIEN DISPARAÎTRE. Les comptes déjà
 * enregistrés restent affichés, restent modifiables et restent en base ; ils
 * cessent seulement de pouvoir s'étendre. La base applique la même règle, en
 * comparant les adresses avant d'écrire.
 */
export default function StepSocials({ draft, update }) {
  const links = draft.socialLinks || []
  const { user } = useAuth()
  const { requirePro } = useProLock()
  const pro = isPro(user)

  const setLinks = (next) => update({ socialLinks: next })

  const patchRow = (uid, patch) =>
    setLinks(links.map((link) => (link.uid === uid ? { ...link, ...patch } : link)))

  const removeRow = (uid) => setLinks(links.filter((link) => link.uid !== uid))

  const addRow = (platform) => {
    const row = { uid: crypto.randomUUID(), platform, title: '', url: '', isActive: true }
    // On insère juste après la dernière ligne de la même plateforme, pour que le
    // nouveau champ apparaisse à sa place et non en bas de la page.
    const lastIndex = links.map((link) => link.platform).lastIndexOf(platform)
    const next = [...links]
    next.splice(lastIndex < 0 ? links.length : lastIndex + 1, 0, row)
    setLinks(next)
  }

  /** Échange deux lignes d'une même plateforme, sans toucher au reste. */
  const moveRow = (uid, direction) => {
    const platform = links.find((link) => link.uid === uid)?.platform
    const positions = links.reduce((list, link, index) => {
      if (link.platform === platform) list.push(index)
      return list
    }, [])
    const rank = positions.findIndex((index) => links[index].uid === uid)
    const target = rank + direction
    if (target < 0 || target >= positions.length) return

    const next = [...links]
    const a = positions[rank]
    const b = positions[target]
    ;[next[a], next[b]] = [next[b], next[a]]
    setLinks(next)
  }

  const filled = links.filter((link) => (link.url || '').trim()).length

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl bg-brand-50 p-4">
        <Icon name="info" size={18} className="mt-0.5 shrink-0 text-brand-600" />
        <p className="text-sm leading-relaxed text-brand-900">
          Ajoutez autant de comptes que vous voulez, y compris plusieurs sur la même plateforme.
          Donnez-leur un nom — « Compte personnel », « Ma boutique » — pour qu'on s'y retrouve sur
          votre mini-site. {filled > 0 && <strong>{filled} lien{filled > 1 ? 's' : ''} pour l'instant.</strong>}
        </p>
      </div>

      {SOCIAL_NETWORKS.map((network) => {
        const rows = links.filter((link) => link.platform === network.key)
        const remplies = rows.filter((row) => row.url)
        // Verrouillé seulement pour ce qui reste à AJOUTER : les comptes déjà
        // enregistrés continuent de s'afficher et de se modifier.
        const verrouille = network.pro && !pro
        return (
          <Panel key={network.key} className="!p-4">
            <div className="mb-3 flex items-center gap-3">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white"
                style={{ background: rows.some((row) => row.url) ? network.color : '#cbcfe0' }}
              >
                <SocialIcon network={network.key} size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-display text-sm font-bold text-ink-900">
                  {network.label}
                  {verrouille && <Icon name="lock" size={13} className="text-gold-600" />}
                </p>
                {remplies.length > 1 && <p className="hint mt-0.5">{remplies.length} comptes</p>}
              </div>
            </div>

            {verrouille && remplies.length > 0 && (
              <p className="mb-3 rounded-2xl bg-gold-50 px-3.5 py-2.5 text-xs leading-relaxed text-ink-600">
                Vos comptes {network.label} sont conservés et restent visibles sur votre profil.
                Vous pouvez les supprimer ; en ajouter ou changer leur adresse demande Kartaa Pro.
              </p>
            )}

            <div className="space-y-3">
              {(verrouille ? remplies : rows).map((row, index, affichees) => (
                <LinkRow
                  key={row.uid}
                  row={row}
                  index={index}
                  total={affichees.length}
                  network={network}
                  lectureSeule={verrouille}
                  onChange={(patch) => patchRow(row.uid, patch)}
                  onRemove={affichees.length > 1 || row.url ? () => removeRow(row.uid) : null}
                  onMove={(direction) => moveRow(row.uid, direction)}
                />
              ))}
            </div>

            {verrouille ? (
              <VerrouReseau network={network} onUnlock={() => requirePro('proSocials')} />
            ) : (
              <button
                type="button"
                onClick={() => addRow(network.key)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-200 py-2.5 text-sm font-bold text-brand-600 transition-colors hover:border-brand-300 hover:bg-brand-50"
              >
                <Icon name="plus" size={16} />
                Ajouter un autre {network.label.replace(/^Sites web$/, 'site web').replace(/^Autres liens$/, 'lien')}
              </button>
            )}
          </Panel>
        )
      })}
    </div>
  )
}

/**
 * Ce qui remplace le bouton « Ajouter » sur un réseau Pro, en offre gratuite.
 *
 * Il dit ce qui est verrouillé, à quel prix, et mène à la page d'abonnement.
 * Ce n'est pas une erreur et l'écran ne le présente pas comme telle : c'est un
 * choix commercial, annoncé comme tel.
 */
function VerrouReseau({ network, onUnlock }) {
  return (
    <div className="mt-3 rounded-2xl border border-gold-200 bg-gold-50/70 p-3.5 text-center">
      <span className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-gold-100 text-gold-700">
        <Icon name="lock" size={16} />
      </span>
      <p className="mt-2 text-sm font-bold text-ink-900">
        {network.label} — disponible avec Kartaa Pro
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-600">
        {formatPrice()}/mois. Votre téléphone, votre WhatsApp et votre e-mail restent gratuits.
      </p>
      <Button size="sm" icon="crown" className="mt-3" onClick={onUnlock}>
        Débloquer Kartaa Pro
      </Button>
    </div>
  )
}

function LinkRow({ row, index, total, network, onChange, onRemove, onMove, lectureSeule = false }) {
  return (
    <div className="rounded-2xl border border-ink-100 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-400">
          {network.label} {total > 1 ? index + 1 : ''}
        </span>
        <div className="flex items-center gap-1">
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => onMove(-1)}
                disabled={index === 0}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-30"
                aria-label="Monter"
              >
                <Icon name="chevronLeft" size={14} className="rotate-90" />
              </button>
              <button
                type="button"
                onClick={() => onMove(1)}
                disabled={index === total - 1}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-30"
                aria-label="Descendre"
              >
                <Icon name="chevronRight" size={14} className="rotate-90" />
              </button>
            </>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
              aria-label="Supprimer ce lien"
            >
              <Icon name="trash" size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Field label={network.namedFirst ? 'Nom du lien' : 'Nom (facultatif)'}>
          <Input
            value={row.title}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder={network.titlePlaceholder}
            disabled={lectureSeule}
          />
        </Field>
        <Field
          label={network.kind === 'phone' ? 'Numéro' : 'Adresse du lien'}
          hint={lectureSeule ? 'Modifier cette adresse demande Kartaa Pro.' : undefined}
        >
          <Input
            value={row.url}
            onChange={(event) => onChange({ url: event.target.value })}
            placeholder={network.placeholder}
            inputMode={network.kind === 'phone' ? 'tel' : 'url'}
            disabled={lectureSeule}
          />
        </Field>
      </div>
    </div>
  )
}
