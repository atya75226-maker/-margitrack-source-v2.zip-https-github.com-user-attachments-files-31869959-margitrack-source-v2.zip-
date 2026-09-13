import { useState } from 'react'
import { Button, Panel } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import { copyToClipboard, downloadText } from '../../lib/download'
import { useToast } from '../../state/ToastContext'

/**
 * Écran affiché une seule fois : le code de récupération n'est plus consultable
 * ensuite, seul son renouvellement est possible depuis un coffre déverrouillé.
 */
export default function RecoveryCodeScreen({ vaultName, code, onDone, doneLabel = "J'ai conservé mon code" }) {
  const [acknowledged, setAcknowledged] = useState(false)
  const toast = useToast()

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="text-center">
        <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-emerald-50 text-emerald-600">
          <Icon name="shieldCheck" size={30} />
        </span>
        <h1 className="font-display text-2xl font-extrabold text-ink-900">Votre coffre est maintenant protégé.</h1>
        <p className="mt-2 text-sm text-ink-500">« {vaultName} » est chiffré. Voici votre code de récupération.</p>
      </div>

      <Panel className="border-gold-200 bg-gold-50/60 text-center">
        <p className="text-xs font-extrabold uppercase tracking-[.2em] text-gold-700">Code de récupération</p>
        <p className="my-5 select-all font-mono text-2xl font-bold tracking-[.15em] text-ink-900 sm:text-3xl">{code}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            icon="copy"
            onClick={async () => {
              await copyToClipboard(code)
              toast.success('Code copié.')
            }}
          >
            Copier le code
          </Button>
          <Button
            variant="outline"
            icon="download"
            onClick={() => {
              downloadText(
                `Kartaa — Coffre Sécurité\nCoffre : ${vaultName}\nCode de récupération : ${code}\n\nConservez ce code dans un endroit sûr.\nIl permet de réinitialiser le mot de passe du coffre.\n`,
                `code-recuperation-${vaultName.toLowerCase().replace(/\s+/g, '-')}.txt`,
              )
              toast.success('Code téléchargé.')
            }}
          >
            Télécharger le code
          </Button>
        </div>
      </Panel>

      <Panel className="border-rose-100 bg-rose-50/50">
        <div className="flex gap-3">
          <Icon name="alert" size={20} className="mt-0.5 shrink-0 text-rose-600" />
          <div className="text-sm leading-relaxed text-ink-700">
            <p className="font-bold text-rose-700">Conservez ce code dans un endroit sûr.</p>
            <p className="mt-1">
              Il pourra vous permettre de réinitialiser votre mot de passe si vous l'oubliez. Une fois cette page quittée,
              ni le code ni le mot de passe ne seront affichés de nouveau.
            </p>
          </div>
        </div>
      </Panel>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-ink-200 p-4">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink-300 text-brand-600 focus:ring-brand-400"
        />
        <span className="text-sm font-semibold text-ink-700">
          J'ai noté ou téléchargé mon code de récupération et je comprends qu'il ne sera plus affiché.
        </span>
      </label>

      <Button full size="lg" disabled={!acknowledged} onClick={onDone} iconRight="arrowRight">
        {doneLabel}
      </Button>
    </div>
  )
}
