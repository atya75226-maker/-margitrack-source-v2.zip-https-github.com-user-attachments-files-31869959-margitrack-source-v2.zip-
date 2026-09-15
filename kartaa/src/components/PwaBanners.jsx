import { useEffect, useState } from 'react'
import { Button } from './ui'
import { Icon } from './ui/Icons'
import { InstallBanner } from './InstallApp'
import { appliquerMiseAJour, surMiseAJourDisponible } from '../lib/pwa'

/**
 * Les deux bandeaux de l'application : « une nouvelle version est prête » et
 * l'invitation à installer.
 *
 * Aucun des deux ne s'impose. La mise à jour attend un clic — se recharger sous
 * les doigts de quelqu'un en pleine saisie est inacceptable. L'invitation
 * n'apparaît que lorsque le navigateur permet réellement l'installation, et un
 * refus la met en sommeil ; le panneau du profil, lui, reste toujours là.
 */
export default function PwaBanners() {
  return (
    <>
      <BandeauMiseAJour />
      <InstallBanner />
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
