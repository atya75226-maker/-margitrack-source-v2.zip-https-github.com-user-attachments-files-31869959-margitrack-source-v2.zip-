import { useCallback, useEffect, useState } from 'react'
import { Button, Modal, Panel, SectionTitle } from './ui'
import { Icon } from './ui/Icons'
import { APP } from '../config/app.config'
import {
  estInstallee,
  etapesInstallation,
  modeInstallation,
  navigateur,
  noterRefusInstallation,
  peutProposerBandeau,
  proposerInstallation,
  raisonInstallation,
  surInstallationPossible,
} from '../lib/pwa'

/**
 * Installation de l'application.
 *
 * Le principe tient en une phrase : on dit au navigateur ce qu'il peut faire, et
 * on ne prétend jamais qu'il peut faire davantage.
 *
 *   Chrome et Edge     → un bouton qui ouvre la vraie fenêtre d'installation ;
 *   Safari sur iPhone  → la marche à suivre, car l'installation n'y est pas
 *                        programmable : elle passe obligatoirement par Partager ;
 *   Firefox et autres  → la marche à suivre par le menu du navigateur.
 *
 * Ce qu'on ne fait jamais : demander de recharger la page. Si l'installation
 * n'est pas disponible, c'est le navigateur qui ne la propose pas — un
 * rechargement n'y change rien, et le demander revient à faire porter à la
 * personne un défaut qui n'est pas le sien.
 */

/** Suit en direct ce que le navigateur permet. */
export function useModeInstallation() {
  const [mode, setMode] = useState(() => modeInstallation())

  useEffect(() => {
    const evaluer = () => setMode(modeInstallation())
    evaluer()
    return surInstallationPossible(evaluer)
  }, [])

  return mode
}

function Marches() {
  const etapes = etapesInstallation()
  return (
    <ol className="mt-3 space-y-2">
      {etapes.map((etape, index) => (
        <li key={etape} className="flex gap-2.5 text-sm leading-relaxed text-ink-600">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink-100 text-[0.7rem] font-bold text-ink-600">
            {index + 1}
          </span>
          {etape}
        </li>
      ))}
    </ol>
  )
}

/** Panneau complet, pour la page Profil. */
export function InstallPanel() {
  const mode = useModeInstallation()
  const [busy, setBusy] = useState(false)

  const installer = useCallback(async () => {
    setBusy(true)
    try {
      await proposerInstallation()
    } finally {
      setBusy(false)
    }
  }, [])

  if (mode === 'installee') {
    return (
      <Panel>
        <SectionTitle icon="check" title="Application installée" />
        <p className="text-sm leading-relaxed text-ink-500">
          Vous utilisez {APP.name} depuis votre écran d'accueil. Votre session y tient dans la durée,
          et les mises à jour vous sont proposées sans rien réinstaller.
        </p>
      </Panel>
    )
  }

  return (
    <Panel>
      <SectionTitle
        icon="download"
        title={`Installer ${APP.name}`}
        subtitle="Sur votre écran d'accueil, sans passer par un magasin d'applications."
      />

      {mode === 'native' && (
        <Button full icon="download" loading={busy} onClick={installer}>
          Installer l'application
        </Button>
      )}

      {mode !== 'native' && (
        <div>
          <p className="text-sm font-semibold text-ink-800">
            {navigateur() === 'fenetre-integree'
              ? 'Ouvrez le site dans Chrome'
              : `Installer en ${etapesInstallation().length} gestes`}
          </p>
          {/* Nommer la raison plutôt que de laisser croire à une panne : deux
              téléphones ouvrant la même adresse ne se comportent pas pareil. */}
          <p className="hint mt-0.5">{raisonInstallation()}</p>
          <Marches />
          <p className="hint mt-3">Adresse à ouvrir : {APP.publicDomain}</p>
        </div>
      )}
    </Panel>
  )
}

/**
 * Bandeau flottant, proposé dès la première visite quand l'installation est
 * réellement possible. Un refus le met en sommeil trois semaines ; le panneau du
 * profil, lui, reste toujours accessible.
 */
export function InstallBanner() {
  const mode = useModeInstallation()
  const [ecarte, setEcarte] = useState(false)
  const [busy, setBusy] = useState(false)

  if (ecarte || mode !== 'native' || estInstallee() || !peutProposerBandeau()) return null

  return (
    <div className="fixed inset-x-0 bottom-[4.75rem] z-40 p-3 lg:bottom-0 lg:left-64">
      <div className="mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-ink-900 p-4 text-white shadow-lg">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10">
          <Icon name="download" size={19} className="text-gold-400" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold">Installer {APP.name}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-white/70">
            Sur votre écran d'accueil, avec votre session qui tient dans la durée. Aucun magasin
            d'applications n'est nécessaire.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="light"
              loading={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await proposerInstallation()
                } finally {
                  setBusy(false)
                  setEcarte(true)
                }
              }}
            >
              Installer
            </Button>
            <Button
              size="sm"
              variant="ghostLight"
              onClick={() => {
                noterRefusInstallation()
                setEcarte(true)
              }}
            >
              Plus tard
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Bouton d'installation utilisable partout, et qui mène toujours quelque part.
 *
 * Quand le navigateur a remis sa proposition, il ouvre la vraie fenêtre
 * d'installation. Sinon il ouvre la marche à suivre de CE navigateur — Chrome
 * Android propose toujours « Installer l'application » dans son menu pour un
 * site éligible, même lorsqu'il n'a pas émis d'évènement. Un bouton qui ne
 * ferait rien dans ce cas serait pire que pas de bouton du tout.
 */
export function InstallButton({ size = 'lg', className = '' }) {
  const mode = useModeInstallation()
  const [busy, setBusy] = useState(false)
  const [marche, setMarche] = useState(false)

  if (mode === 'installee') return null

  return (
    <>
      <Button
        size={size}
        icon="download"
        className={className}
        loading={busy}
        onClick={async () => {
          if (mode === 'native') {
            setBusy(true)
            try {
              await proposerInstallation()
            } finally {
              setBusy(false)
            }
            return
          }
          setMarche(true)
        }}
      >
        Installer {APP.name}
      </Button>

      <Modal
        open={marche}
        onClose={() => setMarche(false)}
        title={`Installer ${APP.name}`}
        description={raisonInstallation()}
        size="sm"
      >
        <Marches />
        <p className="hint mt-4">Adresse à ouvrir : {APP.publicDomain}</p>
      </Modal>
    </>
  )
}
