import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, ConfirmDialog, Field, FileDrop, Input, Modal, Panel, Progress, Spinner } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import { addFile, createFolder, openFile, removeFile, removeFolder, usedBytesOf } from '../../lib/vaultService'
import { formatBytes, formatDateTime } from '../../lib/format'
import { downloadBlob } from '../../lib/download'
import { useToast } from '../../state/ToastContext'
import { useProLock } from '../../components/ProLock'

const CATEGORY_ICON = { image: 'image', video: 'video', audio: 'video', pdf: 'file', document: 'file' }

/** Explorateur de fichiers d'un coffre déverrouillé. */
export default function VaultBrowser({
  vault, vaultKey, token = null, onChange, readOnly = false,
  quotaBytes, usedBytes = null, quotaLabel = null,
}) {
  const [folderId, setFolderId] = useState(null)
  const [uploading, setUploading] = useState(null)
  const [preview, setPreview] = useState(null)
  const [folderModal, setFolderModal] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const toast = useToast()
  const { showProLock } = useProLock()
  const navigate = useNavigate()

  const files = useMemo(
    () => (vault.files || []).filter((file) => (folderId ? file.folderId === folderId : !file.folderId)),
    [vault.files, folderId],
  )
  // L'espace compté est celui de tout le compte, comme la règle appliquée par la
  // base : le quota ne se divise pas entre les coffres.
  const used = usedBytes ?? usedBytesOf(vault)
  const restant = quotaBytes ? Math.max(0, quotaBytes - used) : null
  const plein = quotaBytes ? used >= quotaBytes : false

  const upload = async (list) => {
    let current = vault
    // Le total suit les ajouts au fur et à mesure : une série de petits fichiers
    // ne doit pas passer sous prétexte qu'aucun ne dépasse à lui seul.
    let cumul = used
    let ajoutes = 0
    let refuses = 0

    for (let index = 0; index < list.length; index += 1) {
      const file = list[index]

      if (quotaBytes && cumul + file.size > quotaBytes) {
        refuses += 1
        continue
      }

      setUploading({ name: file.name, index: index + 1, total: list.length })
      try {
        current = await addFile(current, vaultKey, file, folderId)
        cumul += file.size
        ajoutes += 1
      } catch (error) {
        toast.error(error.message || `« ${file.name} » n'a pas pu être ajouté.`)
      }
    }
    setUploading(null)
    onChange(current)

    if (refuses) {
      // Un seul chemin pour l'abonnement : la fenêtre Pro, qui mène à « Mon abonnement ».
      showProLock('storage')
      toast.error(
        refuses > 1
          ? `${refuses} fichiers dépassent l'espace disponible.`
          : "Ce fichier dépasse l'espace disponible.",
      )
    }
    if (ajoutes) {
      toast.success(ajoutes > 1 ? `${ajoutes} fichiers ajoutés et chiffrés.` : 'Fichier ajouté et chiffré.')
    }
    return
  }

  return (
    <div className="space-y-5">
      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-base font-bold text-ink-900">Contenu du coffre</p>
            <p className="hint mt-0.5">
              {(vault.files || []).length} fichier{(vault.files || []).length > 1 ? 's' : ''}
            </p>
          </div>
          {!readOnly && (
            <Button size="sm" variant="outline" icon="folderPlus" onClick={() => setFolderModal(true)}>
              Nouveau dossier
            </Button>
          )}
        </div>

        {/* L'espace disponible se lit d'un coup d'œil : c'est lui qui décide si
            un fichier de plus pourra être ajouté. */}
        {quotaBytes ? (
          <div className="mb-4 rounded-2xl bg-ink-50 p-4">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-display text-sm font-bold text-ink-900">Stockage</span>
              <span className="text-sm font-semibold text-ink-700">
                {formatBytes(used)} / {formatBytes(quotaBytes)} utilisés
              </span>
            </div>
            <Progress value={Math.min(100, (used / quotaBytes) * 100)} tone={used / quotaBytes > 0.85 ? 'danger' : 'brand'} />
            <p className="hint mt-2">
              {plein ? 'Espace saturé.' : `Il reste ${formatBytes(restant)}.`}
              {quotaLabel ? ` Offre ${quotaLabel}.` : ''}
            </p>
          </div>
        ) : null}

        {/* Quota atteint : on le dit ici, en plus du refus au moment de l'ajout. */}
        {!readOnly && plein && (
          <div className="mb-4 rounded-2xl border border-gold-200 bg-gold-50/70 p-4">
            <p className="flex items-center gap-2 font-display text-sm font-bold text-ink-900">
              <Icon name="lock" size={16} className="text-gold-700" />
              Espace de stockage gratuit atteint
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
              Votre Coffre Sécurité gratuit est limité à {formatBytes(quotaBytes)}. Passez à Pro pour obtenir
              davantage d'espace.
            </p>
            {/* Un seul bouton, un seul chemin : la page « Mon abonnement ». */}
            <Button size="sm" icon="crown" className="mt-3" onClick={() => navigate('/app/abonnement')}>
              Passer à Pro
            </Button>
          </div>
        )}

        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <FolderChip active={!folderId} label="Tous les fichiers" icon="grid" onClick={() => setFolderId(null)} />
          {(vault.folders || []).map((folder) => (
            <FolderChip
              key={folder.id}
              active={folderId === folder.id}
              label={folder.name}
              icon="folder"
              count={(vault.files || []).filter((file) => file.folderId === folder.id).length}
              onClick={() => setFolderId(folder.id)}
              onRemove={
                readOnly
                  ? null
                  : async () => {
                      const updated = await removeFolder(vault, folder.id)
                      setFolderId(null)
                      onChange(updated)
                    }
              }
            />
          ))}
        </div>
      </Panel>

      {!readOnly && (
        <FileDrop
          onFiles={upload}
          disabled={!!uploading}
          label={uploading ? `Chiffrement de « ${uploading.name} »…` : 'Ajoutez vos photos, vidéos et documents'}
          hint={
            uploading
              ? `${uploading.index} sur ${uploading.total}`
              : "Chaque fichier est chiffré sur votre appareil avant d'être enregistré."
          }
          icon={uploading ? 'lock' : 'upload'}
        />
      )}

      {files.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              vault={vault}
              vaultKey={vaultKey}
              token={token}
              onOpen={() => setPreview(file)}
              onDelete={readOnly ? null : () => setToDelete(file)}
            />
          ))}
        </div>
      ) : (
        <Panel className="text-center">
          <Icon name="folder" size={28} className="mx-auto mb-3 text-ink-300" />
          <p className="font-display text-sm font-bold text-ink-900">Ce dossier est vide</p>
          <p className="mx-auto mt-1 max-w-xs hint">
            {readOnly ? "Aucun fichier n'a encore été déposé ici." : 'Ajoutez vos premiers fichiers ci-dessus.'}
          </p>
        </Panel>
      )}

      <PreviewModal file={preview} vault={vault} vaultKey={vaultKey} token={token} onClose={() => setPreview(null)} />

      <Modal
        open={folderModal}
        onClose={() => setFolderModal(false)}
        title="Nouveau dossier"
        size="sm"
        footer={
          <Button
            full
            disabled={!folderName.trim()}
            onClick={async () => {
              const updated = await createFolder(vault, folderName)
              setFolderName('')
              setFolderModal(false)
              onChange(updated)
            }}
          >
            Créer le dossier
          </Button>
        }
      >
        <Field label="Nom du dossier">
          <Input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Diplômes" autoFocus />
        </Field>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Supprimer « ${toDelete?.name} » ?`}
        description="Le fichier chiffré sera définitivement supprimé."
        confirmLabel="Supprimer"
        onConfirm={async () => {
          const updated = await removeFile(vault, toDelete.id)
          onChange(updated)
          toast.success('Fichier supprimé.')
        }}
      />
    </div>
  )
}

function FolderChip({ active, label, icon, count, onClick, onRemove }) {
  return (
    <span
      className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
        active ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:border-ink-300'
      }`}
    >
      <button type="button" onClick={onClick} className="flex items-center gap-2">
        <Icon name={icon} size={16} />
        {label}
        {typeof count === 'number' && <span className="text-xs text-ink-400">{count}</span>}
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} className="text-ink-300 hover:text-rose-600" aria-label={`Supprimer ${label}`}>
          <Icon name="x" size={14} />
        </button>
      )}
    </span>
  )
}

/** Vignette : les images sont déchiffrées en mémoire, uniquement pour l'affichage. */
function FileCard({ file, vault, vaultKey, token, onOpen, onDelete }) {
  const [thumb, setThumb] = useState(null)

  useEffect(() => {
    let url = null
    let cancelled = false
    if (file.category === 'image' && file.size < 12 * 1024 * 1024) {
      openFile(vault, vaultKey, file.id, { log: false, token })
        .then((result) => {
          if (cancelled) {
            URL.revokeObjectURL(result.url)
            return
          }
          url = result.url
          setThumb(result.url)
        })
        .catch(() => {})
    }
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [file.id, file.category, file.size, vault, vaultKey])

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <span className="flex h-28 items-center justify-center overflow-hidden bg-ink-100">
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon name={CATEGORY_ICON[file.category] || 'file'} size={28} className="text-ink-400" />
          )}
        </span>
        <span className="block p-3">
          <span className="block truncate text-xs font-bold text-ink-900">{file.name}</span>
          <span className="mt-0.5 block text-[0.68rem] text-ink-400">{formatBytes(file.size)}</span>
        </span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-xl bg-white/90 text-ink-500 opacity-0 shadow-soft transition-opacity hover:text-rose-600 group-hover:opacity-100"
          aria-label="Supprimer"
        >
          <Icon name="trash" size={15} />
        </button>
      )}
    </div>
  )
}

function PreviewModal({ file, vault, vaultKey, token, onClose }) {
  const [state, setState] = useState({ loading: true, url: null, bytes: null })
  const toast = useToast()

  useEffect(() => {
    let url = null
    let cancelled = false
    if (!file) return undefined
    setState({ loading: true, url: null, bytes: null })
    openFile(vault, vaultKey, file.id, { token })
      .then((result) => {
        if (cancelled) {
          URL.revokeObjectURL(result.url)
          return
        }
        url = result.url
        setState({ loading: false, url: result.url, bytes: result.bytes })
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, url: null, bytes: null })
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [file, vault, vaultKey])

  if (!file) return null

  return (
    <Modal
      open
      onClose={onClose}
      title={file.name}
      description={`${formatBytes(file.size)} • ajouté le ${formatDateTime(file.addedAt)}`}
      size="lg"
      footer={
        <Button
          full
          icon="download"
          disabled={!state.bytes}
          onClick={() => {
            downloadBlob(new Blob([state.bytes], { type: file.mime }), file.name)
            toast.success('Fichier déchiffré et téléchargé.')
          }}
        >
          Télécharger
        </Button>
      }
    >
      <div className="flex min-h-[200px] items-center justify-center overflow-hidden rounded-2xl bg-ink-950">
        {state.loading ? (
          <span className="flex flex-col items-center gap-3 py-16 text-white/70">
            <Spinner size={24} />
            <span className="text-sm">Déchiffrement…</span>
          </span>
        ) : !state.url ? (
          <span className="p-10 text-center text-sm text-white/60">Ce fichier n'a pas pu être récupéré.</span>
        ) : file.category === 'image' ? (
          <img src={state.url} alt={file.name} className="max-h-[60vh] w-full object-contain" />
        ) : file.category === 'video' ? (
          <video src={state.url} controls className="max-h-[60vh] w-full" />
        ) : file.category === 'audio' ? (
          <audio src={state.url} controls className="w-full p-8" />
        ) : file.category === 'pdf' ? (
          <iframe src={state.url} title={file.name} className="h-[60vh] w-full bg-white" />
        ) : (
          <span className="flex flex-col items-center gap-3 p-10 text-white/70">
            <Icon name="file" size={32} />
            <span className="text-sm">Aperçu indisponible pour ce format.</span>
          </span>
        )}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Badge tone="success" icon="shieldCheck">Déchiffré en mémoire</Badge>
        <Badge tone="neutral" icon="link">URL temporaire</Badge>
      </div>
    </Modal>
  )
}
