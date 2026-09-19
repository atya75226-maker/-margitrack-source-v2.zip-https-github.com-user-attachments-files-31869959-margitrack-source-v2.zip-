import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Panel } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import { useToast } from '../../state/ToastContext'
import { copyToClipboard } from '../../lib/download'
import { ensureHttp, telHref } from '../../lib/format'
import {
  decodeFile, decodeFrame, interpretScan, readHistory, pushHistory, clearHistory,
} from '../../lib/qrScanner'

const INTERVALLE_MS = 140

const ICONE_PAR_TYPE = {
  card: 'card',
  url: 'globe',
  internal: 'link',
  vcard: 'user',
  phone: 'phone',
  text: 'file',
}

/**
 * Scanner universel. Il lit n'importe quel QR Code : une carte Kartaa s'ouvre
 * directement dans l'application, le reste est proposé à l'ouverture ou à la copie.
 */
export default function ScannerPage() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fluxRef = useRef(null)
  const boucleRef = useRef(null)
  const fichierRef = useRef(null)

  const [etat, setEtat] = useState('demarrage') // demarrage | actif | refuse | indisponible
  const [resultat, setResultat] = useState(null)
  const [historique, setHistorique] = useState(() => readHistory())
  const navigate = useNavigate()
  const toast = useToast()

  const arreterCamera = useCallback(() => {
    if (boucleRef.current) {
      clearInterval(boucleRef.current)
      boucleRef.current = null
    }
    fluxRef.current?.getTracks().forEach((piste) => piste.stop())
    fluxRef.current = null
  }, [])

  const traiter = useCallback((texte) => {
    const lecture = interpretScan(texte)
    if (lecture.kind === 'empty') return
    navigator.vibrate?.(60)
    arreterCamera()
    setResultat(lecture)
    setHistorique(pushHistory({ value: lecture.value, kind: lecture.kind, label: lecture.label || null }))
  }, [arreterCamera])

  const demarrerCamera = useCallback(async () => {
    setResultat(null)
    setEtat('demarrage')
    if (!navigator.mediaDevices?.getUserMedia) {
      setEtat('indisponible')
      return
    }
    try {
      const flux = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      fluxRef.current = flux
      const video = videoRef.current
      if (!video) return
      video.srcObject = flux
      await video.play()
      setEtat('actif')

      boucleRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return
        try {
          const texte = await decodeFrame(videoRef.current, canvasRef.current)
          if (texte) traiter(texte)
        } catch {
          /* image illisible : on retente à la passe suivante */
        }
      }, INTERVALLE_MS)
    } catch (erreur) {
      setEtat(erreur?.name === 'NotAllowedError' ? 'refuse' : 'indisponible')
    }
  }, [traiter])

  useEffect(() => {
    demarrerCamera()
    return arreterCamera
  }, [demarrerCamera, arreterCamera])

  const depuisImage = async (fichier) => {
    if (!fichier) return
    try {
      const texte = await decodeFile(fichier)
      if (texte) traiter(texte)
      else toast.error('Aucun QR Code trouvé dans cette image.')
    } catch {
      toast.error("Cette image n'a pas pu être lue.")
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-extrabold text-ink-900">Scanner</h1>
        <p className="mt-1 text-sm text-ink-500">
          Visez un QR Code. Une carte Kartaa s'ouvre ici même ; tout autre code reste lisible.
        </p>
      </header>

      <div className="relative overflow-hidden rounded-3xl bg-ink-950">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`aspect-[3/4] w-full object-cover sm:aspect-video ${etat === 'actif' ? '' : 'opacity-0'}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {etat === 'actif' && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative h-56 w-56">
              {[
                'left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl',
                'right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl',
                'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl',
                'right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl',
              ].map((coin) => (
                <span key={coin} className={`absolute h-10 w-10 border-gold-400 ${coin}`} />
              ))}
            </div>
          </div>
        )}

        {etat !== 'actif' && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <div>
              <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-white">
                <Icon name={etat === 'demarrage' ? 'camera2' : 'alert'} size={26} />
              </span>
              <p className="font-display text-base font-bold text-white">
                {etat === 'demarrage' && 'Ouverture de la caméra…'}
                {etat === 'refuse' && 'Accès à la caméra refusé'}
                {etat === 'indisponible' && 'Caméra indisponible'}
              </p>
              <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-white/60">
                {etat === 'refuse'
                  ? 'Autorisez la caméra dans les réglages du navigateur, ou choisissez une photo du QR Code.'
                  : etat === 'indisponible'
                    ? 'Aucune caméra utilisable sur cet appareil. Vous pouvez ouvrir une photo du QR Code.'
                    : "Autorisez l'accès quand votre navigateur le demande."}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" icon="refresh" onClick={demarrerCamera}>
          Relancer
        </Button>
        <Button variant="outline" icon="image" onClick={() => fichierRef.current?.click()}>
          Ouvrir une photo
        </Button>
        <input
          ref={fichierRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            depuisImage(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>

      {resultat && (
        <ResultatScan
          lecture={resultat}
          onOuvrir={(route) => navigate(route)}
          onRelancer={demarrerCamera}
          onCopier={async () => {
            await copyToClipboard(resultat.value)
            toast.success('Contenu copié.')
          }}
        />
      )}

      {historique.length > 0 && (
        <Panel>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-display text-sm font-bold text-ink-900">Derniers scans</p>
            <button
              type="button"
              onClick={() => setHistorique(clearHistory())}
              className="text-xs font-bold text-ink-400 hover:text-rose-600"
            >
              Effacer
            </button>
          </div>
          <div className="space-y-4">
            {grouperParJour(historique).map(({ titre, entrees }) => (
              <div key={titre}>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-400">{titre}</p>
                <ul className="divide-y divide-ink-100">
                  {entrees.map((entree) => (
                    <li key={entree.value + entree.at}>
                      <button
                        type="button"
                        onClick={() => setResultat(interpretScan(entree.value))}
                        className="flex w-full items-center gap-3 py-3 text-left"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-500">
                          <Icon name={ICONE_PAR_TYPE[entree.kind] || 'qr'} size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink-800">
                            {entree.label || entree.value}
                          </span>
                          <span className="block truncate text-xs text-ink-400">{entree.value}</span>
                        </span>
                        <Icon name="chevronRight" size={16} className="shrink-0 text-ink-300" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="hint mt-2">Cet historique reste sur cet appareil.</p>
        </Panel>
      )}
    </div>
  )
}

function ResultatScan({ lecture, onOuvrir, onRelancer, onCopier }) {
  const TITRES = {
    card: 'Carte Kartaa',
    internal: 'Page Kartaa',
    url: 'Adresse web',
    vcard: 'Fiche contact',
    phone: 'Numéro de téléphone',
    text: 'Texte',
  }

  return (
    <Panel className="animate-fade-up border-brand-200">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Icon name={ICONE_PAR_TYPE[lecture.kind] || 'qr'} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-ink-900">{TITRES[lecture.kind] || 'Code lu'}</p>
          <p className="mt-0.5 break-all text-xs leading-relaxed text-ink-500">{lecture.value}</p>
        </div>
      </div>

      <div className="space-y-2">
        {(lecture.kind === 'card' || lecture.kind === 'internal') && (
          <Button full icon="arrowRight" onClick={() => onOuvrir(lecture.route)}>
            Voir cette page
          </Button>
        )}
        {lecture.kind === 'url' && (
          <Button as="a" href={ensureHttp(lecture.value)} target="_blank" rel="noreferrer" full icon="external">
            Ouvrir {lecture.label}
          </Button>
        )}
        {lecture.kind === 'phone' && (
          <Button as="a" href={telHref(lecture.value)} full icon="phone">
            Appeler ce numéro
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" icon="copy" onClick={onCopier}>
            Copier
          </Button>
          <Button variant="outline" icon="scan" onClick={onRelancer}>
            Scanner à nouveau
          </Button>
        </div>
      </div>
    </Panel>
  )
}

/**
 * Regroupe les scans par jour : « Aujourd'hui », « Hier », puis la date.
 *
 * Un horodatage complet sur chaque ligne se lit mal et se compare mal ; le jour
 * en tête de groupe suffit, et la ligne peut alors montrer l'adresse scannée,
 * bien plus utile pour reconnaître un scan.
 */
function grouperParJour(entrees) {
  const jour = (valeur) => {
    const date = new Date(valeur)
    date.setHours(0, 0, 0, 0)
    return date.getTime()
  }
  const aujourdhui = jour(Date.now())
  const hier = aujourdhui - 24 * 60 * 60 * 1000

  const groupes = new Map()
  entrees.forEach((entree) => {
    const cle = jour(entree.at)
    if (!groupes.has(cle)) groupes.set(cle, [])
    groupes.get(cle).push(entree)
  })

  return Array.from(groupes.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([cle, liste]) => ({
      titre:
        cle === aujourdhui
          ? "Aujourd'hui"
          : cle === hier
            ? 'Hier'
            : new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(cle)),
      entrees: liste,
    }))
}
