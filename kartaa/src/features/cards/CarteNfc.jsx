import { useEffect, useRef, useState } from 'react'
import { Button, Modal, Panel, SectionTitle } from '../../components/ui'
import { Icon } from '../../components/ui/Icons'
import { copyToClipboard } from '../../lib/download'
import { ecrireUrl, nfcDisponible, raisonIndisponible } from '../../lib/nfc'
import { repo } from '../../lib/storage'
import { useToast } from '../../state/ToastContext'

/**
 * Programmer une carte NFC.
 *
 * Une puce NFC ne contient qu'une adresse : celle du mini-site, la même que
 * dans le QR Code. Approcher un téléphone revient donc exactement à scanner —
 * deux gestes, une seule destination. Rien de personnel n'est écrit sur la
 * puce : ce qui y est inscrit est lisible par quiconque l'approche, et ne se
 * corrige pas à distance.
 *
 * Écrire depuis le navigateur n'est possible que là où Web NFC existe — Chrome
 * sur Android. Ailleurs, on ne montre pas un bouton mort : on donne l'adresse à
 * inscrire et on explique comment. Une fois programmée, la puce fonctionne
 * partout, y compris sur les iPhone, qui lisent les puces sans application.
 */
export default function CarteNfc({ card, url }) {
  const toast = useToast()
  const [ouvert, setOuvert] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [supports, setSupports] = useState([])
  const abandon = useRef(null)

  const disponible = nfcDisponible()
  const raison = raisonIndisponible()

  const relireSupports = () => {
    repo.cards.media(card.id)
      .then((liste) => setSupports(liste.filter((support) => support.kind === 'nfc')))
      .catch(() => null)
  }

  useEffect(() => {
    let vivant = true
    repo.cards.media(card.id)
      .then((liste) => vivant && setSupports(liste.filter((support) => support.kind === 'nfc')))
      .catch(() => null)
    return () => {
      vivant = false
      abandon.current?.abort()
    }
  }, [card.id])

  const programmer = async () => {
    setErreur(null)
    setEnCours(true)
    abandon.current = new AbortController()
    try {
      const ecrite = await ecrireUrl(url, { signal: abandon.current.signal })
      if (!ecrite) return // annulé : rien à annoncer
      // La puce est programmée : on garde trace du support, pour savoir
      // combien de cartes mènent à ce profil.
      await repo.cards.addMedium(card.id, { kind: 'nfc', label: 'Carte NFC', status: 'active' }).catch(() => null)
      relireSupports()
      setOuvert(false)
      toast.success('Carte NFC programmée. Approchez-la d’un téléphone pour vérifier.')
    } catch (probleme) {
      setErreur(probleme.message)
    } finally {
      setEnCours(false)
    }
  }

  const fermer = () => {
    abandon.current?.abort()
    setEnCours(false)
    setErreur(null)
    setOuvert(false)
  }

  return (
    <>
      <Panel>
        <SectionTitle
          icon="nfc"
          title="Ma carte NFC"
          subtitle="Une puce qui ouvre votre profil quand on approche un téléphone."
        />

        <p className="text-sm leading-relaxed text-ink-600">
          La puce ne contient qu'une adresse — celle de votre mini-site, la même que votre QR Code. Rien de personnel
          n'y est inscrit, et vous pouvez modifier vos informations sans reprogrammer la carte.
        </p>

        {disponible ? (
          <Button className="mt-4" icon="nfc" onClick={() => setOuvert(true)}>
            Programmer ma carte NFC
          </Button>
        ) : (
          <div className="mt-4 flex gap-3 rounded-2xl border border-gold-200 bg-gold-50/70 p-3.5">
            <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-gold-600" />
            <div className="min-w-0">
              <p className="text-xs leading-relaxed text-ink-600">{raison}</p>
              <p className="mt-2 text-xs leading-relaxed text-ink-600">
                Adresse à inscrire sur la puce :
              </p>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-white px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-700">{url}</span>
                <button
                  type="button"
                  className="shrink-0 text-xs font-bold text-brand-600"
                  onClick={async () => {
                    await copyToClipboard(url)
                    toast.success('Adresse copiée.')
                  }}
                >
                  Copier
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-500">
                Une fois programmée, la puce fonctionne partout : les iPhone récents et la plupart des Android
                la lisent sans aucune application.
              </p>
            </div>
          </div>
        )}

        {supports.length > 0 && (
          <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <Icon name="check" size={14} />
            {supports.length} carte{supports.length > 1 ? 's' : ''} NFC programmée{supports.length > 1 ? 's' : ''} depuis cette application
          </p>
        )}
      </Panel>

      <Modal open={ouvert} onClose={fermer} title="Programmer la carte NFC" size="sm">
        <div className="text-center">
          <span className={`mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand-50 text-brand-600 ${enCours ? 'animate-pulse' : ''}`}>
            <Icon name="nfc" size={34} />
          </span>
          <p className="mt-4 text-sm font-bold text-ink-900">
            {enCours ? 'Approchez la carte du téléphone' : 'Prêt à écrire'}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
            {enCours
              ? "Posez la puce contre le dos du téléphone et gardez-la immobile. L'écriture prend une seconde."
              : "Le téléphone va demander l'autorisation d'utiliser le NFC, puis attendre que vous approchiez la carte."}
          </p>
          <p className="mt-3 break-all rounded-xl bg-ink-50 px-3 py-2 font-mono text-xs text-ink-600">{url}</p>

          {erreur && (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2.5 text-left text-xs leading-relaxed text-rose-700">{erreur}</p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={fermer}>
              {enCours ? 'Arrêter' : 'Annuler'}
            </Button>
            <Button icon="nfc" loading={enCours} onClick={programmer}>
              {erreur ? 'Réessayer' : 'Écrire'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
