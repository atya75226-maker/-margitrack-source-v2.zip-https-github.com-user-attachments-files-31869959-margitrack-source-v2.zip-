import { Icon } from './ui/Icons'
import { useReseau } from '../state/ReseauContext'

/**
 * Indicateur discret : une pastille et deux mots.
 *
 * Il ne dit que ce qui est vrai. « Synchronisé » n'apparaît que lorsque la file
 * est réellement vide ; tant qu'une modification attend, il le montre.
 */
const ETATS = {
  'hors-ligne': { texte: 'Hors connexion', icone: 'cloudOff', classe: 'bg-gold-50 text-gold-700' },
  'en-attente': { texte: 'À synchroniser', icone: 'clock', classe: 'bg-gold-50 text-gold-700' },
  synchronisation: { texte: 'Synchronisation…', icone: 'refresh', classe: 'bg-brand-50 text-brand-700' },
  synchronise: { texte: 'Synchronisé', icone: 'check', classe: 'bg-emerald-50 text-emerald-700' },
}

export default function EtatReseau({ compact = false }) {
  const { etat, enAttente } = useReseau()
  // Tout va bien et rien n'attend : inutile d'occuper l'écran pour le dire.
  if (etat === 'synchronise' && compact) return null

  const details = ETATS[etat] || ETATS.synchronise
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${details.classe}`}
      title={enAttente ? `${enAttente} modification${enAttente > 1 ? 's' : ''} enregistrée${enAttente > 1 ? 's' : ''} sur cet appareil` : details.texte}
    >
      <Icon name={details.icone} size={13} />
      {details.texte}
      {enAttente > 0 && etat !== 'synchronisation' ? ` (${enAttente})` : ''}
    </span>
  )
}
