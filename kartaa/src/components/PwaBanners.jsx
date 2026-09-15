import { useEffect, useState } from 'react'
import { Button } from './ui'
import { Icon } from './ui/Icons'
import {
  appliquerMiseAJour,
  estInstallee,
  noterRefusInstallation,
  peutProposerInstallation,
  proposerInstallation,
  propositionDisponible,
  surInstallationPossible,
  surMiseAJourDisponible,
} from '../lib/pwa'

/**
 * Les deux bandeaux de l'application installée : « une nouvelle version est
 * prête » et « installez Kartaa sur votre écran d'accueil ».
 *
 * Aucun des deux ne s'impose. La mise à jour attend un clic — se recharger sous
 * les doigts de quelqu'un en pleine saisie est inacceptable. L'invitation
 * d'installation n'apparaît qu'à partir de la deuxième visite, et un refus la
 * repousse de trois semaines.
 */
export default function PwaBanners() {
  return (
    <>
      <BandeauMiseAJour />
      <BandeauInstallation />
    </>
  )
}

function BandeauMiseAJour() {
  const [disponible, setDisponible] = useState(false)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => surMiseAJourDisponible(() => setDisponible(true)), [])

  if (!disponible) return null

  return (
    <div className="fixed inset-x-0 bottom-[4.75rem] z-50 p-3 lg:bottom-0 lg:left-64">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-emerald-600 p-3.5 text-white shadow-lg">
        <Icon name="refresh" size={20} className="shrink-0" />
        <p className="min-w-0 flex-1 text-sm font-semibold">Une nouvelle version est prête.</p>
        <Button
          size="sm"
          variant="light"
          loading={enCours}
          onClick={() => {
            setEnCours(true)
            appliquerMiseAJour()
          }}
        >
          Mettre à jour
        </Button>
      </div>
    </div>
  )
}

function BandeauInstallation() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (estInstallee()) return undefined
    const evaluer = () => setVisible(propositionDisponible() && peutProposerInstallation())
    evaluer()
    return surInstallationPossible(evaluer)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-[4.75rem] z-40 p-3 lg:bottom-0 lg:left-64">
      <div className="mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-ink-900 p-4 text-white shadow-lg">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10">
          <Icon name="download" size={19} className="text-gold-400" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold">Installer Kartaa</p>
          <p className="mt-0.5 text-xs leading-relaxed text-white/70">
            Sur votre écran d'accueil, avec votre session qui tient dans la durée. Aucun magasin
            d'applications n'est nécessaire.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="light"
              onClick={async () => {
                await proposerInstallation()
                setVisible(false)
              }}
            >
              Installer
            </Button>
            <Button
              size="sm"
              variant="ghostLight"
              onClick={() => {
                noterRefusInstallation()
                setVisible(false)
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
