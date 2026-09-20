import { useEffect, useRef, useState } from 'react'
import { CardArtwork, CardScaler } from '../../components/card/CardArtwork'
import ProfileView from '../public/ProfileView'
import { useCardAssets } from '../../hooks/useCardAssets'
import { DEMO_CARDS } from './demoCards'

/**
 * La scène du haut de page : deux personnes, une carte, un téléphone.
 *
 * Ce qui s'y passe, en boucle : quelqu'un tend sa carte Kartaa, l'approche du
 * téléphone de son interlocuteur, une lueur passe, et le téléphone ouvre le
 * profil professionnel. Les deux personnes restent un instant dessus, puis tout
 * revient à sa place et recommence.
 *
 * DEUX CHOIX QUI TIENNENT TOUT
 *
 * 1. La carte et le téléphone ne sont pas dessinés. Ce sont les vrais
 *    composants — `CardArtwork` pour la carte, `ProfileView` pour l'écran —
 *    posés par-dessus le décor. Ce que la scène montre est donc exactement ce
 *    que l'application produit, et le jour où le profil change, la scène change
 *    avec lui.
 *
 * 2. Tout bouge avec la même horloge. Le bras est dans le SVG, la carte est en
 *    HTML : ils se déplacent du même nombre d'unités — 198 unités de dessin
 *    d'un côté, 157 % de la largeur de la carte de l'autre, ce qui vaut les
 *    mêmes 198 unités. Comme les deux se mettent à l'échelle avec le conteneur,
 *    la main ne lâche jamais la carte, quelle que soit la taille de l'écran.
 *
 * Aucune image n'est téléchargée, aucune vidéo : quelques formes vectorielles
 * et des images-clés CSS. Tout s'arrête sous `prefers-reduced-motion`, et la
 * scène se fige alors sur son moment le plus parlant — le profil ouvert.
 */

/**
 * L'écran du téléphone : une vraie page mobile, à l'échelle de l'écran.
 *
 * Le profil est rendu à sa largeur mobile réelle — 420 px — puis réduit d'un
 * facteur mesuré sur l'écran lui-même. C'est la seule façon d'obtenir la page
 * telle qu'elle s'ouvre vraiment : rien n'est étiré, rien n'est rogné sur les
 * côtés, et la mise en page reste celle du mini-site.
 *
 * L'échelle était auparavant écrite en dur (0,26) alors que l'écran, lui, vaut
 * un pourcentage du conteneur : sur un téléphone, le profil était rendu deux
 * fois et demie trop large et l'on n'en voyait qu'une bande — l'en-tête coloré,
 * pris pour un écran vide. On mesure donc, au lieu de supposer.
 *
 * Une page de profil est plus haute qu'un écran, comme n'importe quelle page
 * ouverte sur un téléphone : on en montre le haut, aligné au bord supérieur, et
 * la suite est simplement hors champ.
 */
function EcranProfil({ card, assets }) {
  const LARGEUR_MOBILE = 420
  const ref = useRef(null)
  const [largeur, setLargeur] = useState(0)

  useEffect(() => {
    const noeud = ref.current
    if (!noeud) return undefined
    const mesurer = () => setLargeur(noeud.getBoundingClientRect().width)
    mesurer()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(noeud)
    return () => observateur.disconnect()
  }, [])

  return (
    <div ref={ref} className="scene-ecran-profil absolute inset-0 overflow-hidden">
      {largeur > 0 && (
        <div
          style={{
            width: LARGEUR_MOBILE,
            transform: `scale(${largeur / LARGEUR_MOBILE})`,
            transformOrigin: 'top left',
          }}
        >
          <ProfileView card={card} assets={{ ...assets, qr: null }} actif={false} publicHref="" onVcard={() => {}} />
        </div>
      )}
    </div>
  )
}

/* Les couleurs du décor, une seule fois. */
const PEAU_A = '#9a683f'
const PEAU_B = '#c98f63'
const VESTE_A = '#5b21b6'
const VESTE_B = '#232a47'
const CHEMISE = '#eef0f8'
const PANTALON_A = '#2a2350'
const PANTALON_B = '#171c30'
const CHEVEUX = '#171821'

export default function SceneAnimee({ className = '' }) {
  const carte = DEMO_CARDS[2]
  const profil = DEMO_CARDS[0]
  const assets = useCardAssets(profil, '')

  return (
    /* Sur téléphone, la scène déborde des marges : les côtés vides sortent de
       l'écran et les personnages gagnent le tiers de taille qui leur manquait.
       La section d'accueil masque déjà ce qui dépasse. */
    <div className={`relative w-[126%] -ml-[13%] sm:mx-auto sm:ml-0 sm:w-full sm:max-w-[920px] ${className}`}>
      {/* La lumière du sol : elle pose les personnages sans les encadrer. */}
      <div className="pointer-events-none absolute inset-x-[8%] bottom-[6%] h-24 rounded-[50%] bg-brand-500/20 blur-3xl" />

      <svg viewBox="0 0 900 480" className="relative w-full" role="img" aria-label="Une personne tend sa carte Kartaa ; le téléphone de son interlocuteur ouvre son profil professionnel">
        <defs>
          <linearGradient id="scene-sol" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity=".10" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Le sol : un trait de lumière, pas une ligne d'horizon. */}
        <rect x="60" y="437" width="780" height="2" rx="1" fill="url(#scene-sol)" />
        <ellipse cx="232" cy="441" rx="96" ry="11" fill="#000000" opacity=".28" />
        <ellipse cx="668" cy="441" rx="96" ry="11" fill="#000000" opacity=".28" />

        {/* ---------------------------------------------------- personne A */}
        {/* Celle qui tend sa carte. Elle respire doucement pendant l'attente. */}
        <g className="scene-respire" style={{ transformBox: 'view-box', transformOrigin: '232px 430px' }}>
          {/* jambes */}
          <path d="M214 268 L206 428" stroke={PANTALON_A} strokeWidth="27" strokeLinecap="round" />
          <path d="M250 268 L260 428" stroke={PANTALON_A} strokeWidth="27" strokeLinecap="round" />
          <ellipse cx="202" cy="432" rx="21" ry="9" fill={CHEVEUX} />
          <ellipse cx="264" cy="432" rx="21" ry="9" fill={CHEVEUX} />

          {/* buste */}
          <path d="M232 150c-30 0-46 20-48 48l-4 66c-1 12 8 18 20 18h64c12 0 21-6 20-18l-4-66c-2-28-18-48-48-48z" fill={VESTE_A} />
          <path d="M214 152l18 22 18-22 8 5-20 62-24-62z" fill={CHEMISE} />
          <path d="M232 174l8 6-5 40-3 6-3-6-5-40z" fill="#f5b229" />

          {/* bras arrière */}
          <path d="M190 178 Q 176 216 182 252" stroke={VESTE_A} strokeWidth="24" strokeLinecap="round" fill="none" />
          <circle cx="183" cy="258" r="11" fill={PEAU_A} />

          {/* tête */}
          <rect x="222" y="124" width="20" height="26" rx="10" fill={PEAU_A} />
          <ellipse cx="232" cy="104" rx="27" ry="29" fill={PEAU_A} />
          <path d="M205 100c0-19 12-29 27-29s27 10 27 29c-5-9-15-13-27-13s-22 4-27 13z" fill={CHEVEUX} />
          <circle cx="240" cy="104" r="2.4" fill={CHEVEUX} />
          <circle cx="252" cy="103" r="2.4" fill={CHEVEUX} />
          <path d="M240 115c4 3 9 3 13-1" stroke={CHEVEUX} strokeWidth="2.2" strokeLinecap="round" fill="none" />

          {/* Le bras qui tend la carte : il avance, attend, puis revient. */}
          <g className="scene-bras">
            <path d="M272 180 Q 316 188 344 206" stroke={VESTE_A} strokeWidth="24" strokeLinecap="round" fill="none" />
            <ellipse cx="352" cy="211" rx="15" ry="12" transform="rotate(22 352 211)" fill={PEAU_A} />
          </g>
        </g>

        {/* ---------------------------------------------------- personne B */}
        {/* Celle qui reçoit. Elle penche légèrement la tête quand le profil s'ouvre. */}
        <g style={{ transformBox: 'view-box', transformOrigin: '668px 430px' }}>
          <path d="M650 268 L642 428" stroke={PANTALON_B} strokeWidth="27" strokeLinecap="round" />
          <path d="M686 268 L696 428" stroke={PANTALON_B} strokeWidth="27" strokeLinecap="round" />
          <ellipse cx="638" cy="432" rx="21" ry="9" fill={CHEVEUX} />
          <ellipse cx="700" cy="432" rx="21" ry="9" fill={CHEVEUX} />

          <path d="M668 150c-30 0-46 20-48 48l-4 66c-1 12 8 18 20 18h64c12 0 21-6 20-18l-4-66c-2-28-18-48-48-48z" fill={VESTE_B} />
          <path d="M650 152l18 22 18-22 8 5-20 62-24-62z" fill={CHEMISE} />
          <path d="M668 174l8 6-5 40-3 6-3-6-5-40z" fill="#7c45f7" />

          {/* bras arrière */}
          <path d="M710 178 Q 724 216 718 252" stroke={VESTE_B} strokeWidth="24" strokeLinecap="round" fill="none" />
          <circle cx="717" cy="258" r="11" fill={PEAU_B} />

          <g className="scene-tete" style={{ transformBox: 'view-box', transformOrigin: '668px 140px' }}>
            <rect x="658" y="124" width="20" height="26" rx="10" fill={PEAU_B} />
            <ellipse cx="668" cy="104" rx="27" ry="29" fill={PEAU_B} />
            <path d="M641 102c0-20 12-31 27-31s27 11 27 31c-4-12-13-18-27-18s-23 6-27 18z" fill="#2a1f18" />
            <circle cx="656" cy="104" r="2.4" fill={CHEVEUX} />
            <circle cx="668" cy="105" r="2.4" fill={CHEVEUX} />
            <path d="M655 116c4 3 9 3 13-1" stroke={CHEVEUX} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          </g>

          {/* Le bras qui tient le téléphone : il ne bouge pas, c'est la carte qui vient. */}
          <path d="M628 182 Q 600 206 594 236" stroke={VESTE_B} strokeWidth="24" strokeLinecap="round" fill="none" />
        </g>
      </svg>

      {/* ------------------------------------------------------- le téléphone */}
      {/* Posé par-dessus le décor, dans la main de la personne B. Son écran est
          le vrai profil public, simplement mis à l'échelle. */}
      <div className="absolute" style={{ left: '58.4%', top: '25%', width: '11.4%' }}>
        {/* La lueur de l'échange, derrière l'appareil : elle l'entoure, elle ne
            le recouvre pas — on doit continuer à voir l'écran. */}
        <span className="scene-lueur pointer-events-none absolute -inset-[35%] rounded-full bg-brand-400/50 blur-2xl" />

        <div className="relative z-10 overflow-hidden rounded-[14%/7%] border-[3px] border-ink-900 bg-ink-950 shadow-card" style={{ aspectRatio: '1 / 2' }}>
          {/* écran d'attente */}
          <div className="scene-ecran-attente absolute inset-0 bg-gradient-to-b from-ink-800 to-ink-950">
            <span className="absolute inset-x-[22%] top-[12%] h-[2%] rounded-full bg-white/25" />
            <span className="absolute inset-x-[30%] top-[20%] h-[1.4%] rounded-full bg-white/15" />
          </div>
          {/* le profil, quand la carte est arrivée */}
          <EcranProfil card={profil} assets={assets} />
        </div>
        {/* Les doigts, par-dessus l'écran : sans eux, le téléphone flotte. */}
        <span
          className="pointer-events-none absolute z-20 left-[-9%] top-[52%] h-[26%] w-[22%] rounded-full"
          style={{ background: PEAU_B, transform: 'rotate(-14deg)' }}
        />
        <span
          className="pointer-events-none absolute z-20 left-[-4%] top-[62%] h-[7%] w-[16%] rounded-full"
          style={{ background: '#b87f56' }}
        />

      </div>

      {/* ------------------------------------------------------------ la carte */}
      {/* Le vrai recto Kartaa. Elle part de la main de A et vient au contact. */}
      <div className="scene-carte absolute" style={{ left: '34.5%', top: '36%', width: '14%' }}>
        <span className="scene-onde pointer-events-none absolute -inset-4 rounded-2xl border border-gold-300/50" />
        <div className="overflow-hidden rounded-lg shadow-card">
          <CardScaler>
            <CardArtwork card={carte} side="front" />
          </CardScaler>
        </div>
      </div>
    </div>
  )
}
