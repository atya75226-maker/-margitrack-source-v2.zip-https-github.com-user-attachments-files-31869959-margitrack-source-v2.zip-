import { useEffect, useRef, useState } from 'react'
import { CardArtwork, CardScaler } from '../../components/card/CardArtwork'
import { useQrVectoriel } from '../../hooks/useCardAssets'
import { APP } from '../../config/app.config'
import { DEMO_CARDS } from './demoCards'

/**
 * La scène d'ouverture : quelqu'un à son bureau, sa carte à la main.
 *
 * Elle est dessinée, pas photographiée. Une photo de banque d'images
 * montrerait un inconnu qui n'a jamais utilisé Kartaa ; un dessin ne prétend
 * rien. Il pèse quelques kilo-octets, s'affiche sans réseau, et se met à
 * l'échelle sans jamais devenir flou.
 *
 * La carte tenue dans la main n'est pas dessinée non plus : c'est le vrai
 * composant `CardArtwork`, avec un vrai QR Code. Ce que la scène montre est
 * donc exactement ce que l'application produit.
 *
 * Les mouvements restent discrets — la carte respire, un reflet passe dessus,
 * la plante bouge à peine — et s'arrêtent tous si le système demande à réduire
 * les animations.
 */

/** Révèle au moment où l'élément entre dans l'écran, une seule fois. */
function useApparition() {
  const ref = useRef(null)
  const [vu, setVu] = useState(false)

  useEffect(() => {
    const noeud = ref.current
    if (!noeud || vu) return undefined
    if (typeof IntersectionObserver === 'undefined') {
      setVu(true)
      return undefined
    }
    const observateur = new IntersectionObserver(
      (entrees) => entrees.forEach((entree) => entree.isIntersecting && setVu(true)),
      { threshold: 0.2 },
    )
    observateur.observe(noeud)
    return () => observateur.disconnect()
  }, [vu])

  return [ref, vu]
}

export default function SceneBureau({ className = '' }) {
  const carte = DEMO_CARDS[2]
  // Le même QR que partout ailleurs sur cette page : il ouvre Kartaa, pas un
  // profil inventé qui n'existerait nulle part.
  const qr = useQrVectoriel(APP.publicOrigin)
  const [ref, vu] = useApparition()

  return (
    <div ref={ref} className={`relative mx-auto w-full max-w-[540px] ${className}`}>
      <div className={vu ? 'animate-fade-up' : 'opacity-0'}>
        <svg viewBox="0 0 540 430" className="w-full" role="img" aria-label="Une personne à son bureau présente sa carte Kartaa">
          <defs>
            <linearGradient id="mur" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1b2138" />
              <stop offset="100%" stopColor="#0d1022" />
            </linearGradient>
            <linearGradient id="fenetre" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7c45f7" stopOpacity=".55" />
              <stop offset="100%" stopColor="#f5b229" stopOpacity=".22" />
            </linearGradient>
            <linearGradient id="veste" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#222846" />
              <stop offset="100%" stopColor="#151a30" />
            </linearGradient>
            <linearGradient id="bureau" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2b3252" />
              <stop offset="100%" stopColor="#1a1f36" />
            </linearGradient>
          </defs>

          {/* ------------------------------------------------------- le bureau */}
          <rect x="0" y="0" width="540" height="430" rx="32" fill="url(#mur)" />

          {/* La fenêtre, et la lumière qui entre */}
          <g opacity=".9">
            <rect x="44" y="46" width="150" height="126" rx="16" fill="url(#fenetre)" />
            <line x1="119" y1="46" x2="119" y2="172" stroke="#0d1022" strokeWidth="4" opacity=".6" />
            <line x1="44" y1="109" x2="194" y2="109" stroke="#0d1022" strokeWidth="4" opacity=".6" />
          </g>
          <path d="M194 60 L470 186 L470 240 L194 120 Z" fill="#ffffff" opacity=".035" />

          {/* La plante, qui bouge à peine */}
          <g className="kartaa-balance" style={{ transformOrigin: '70px 330px' }}>
            <path d="M58 318c-14-16-10-38 6-46 6 16 6 32-6 46z" fill="#2f7d63" />
            <path d="M82 318c14-16 10-38-6-46-6 16-6 32 6 46z" fill="#3c9a7a" />
            <path d="M70 322c0-22 0-38 0-52" stroke="#3c9a7a" strokeWidth="4" strokeLinecap="round" />
          </g>
          <path d="M52 322h36l-5 34a6 6 0 0 1-6 5H63a6 6 0 0 1-6-5z" fill="#c9a24a" opacity=".85" />

          {/* Le plateau */}
          <rect x="0" y="336" width="540" height="94" rx="0" fill="url(#bureau)" />
          <rect x="0" y="336" width="540" height="7" fill="#3a4468" opacity=".7" />

          {/* L'ordinateur, posé devant */}
          <g>
            <path d="M128 336l18-62h104l18 62z" fill="#2b3252" />
            <rect x="150" y="282" width="96" height="48" rx="5" fill="#0d1022" />
            <rect x="163" y="294" width="70" height="5" rx="2.5" fill="#7c45f7" opacity=".7" />
            <rect x="163" y="305" width="48" height="5" rx="2.5" fill="#ffffff" opacity=".22" />
            <rect x="163" y="316" width="58" height="5" rx="2.5" fill="#ffffff" opacity=".14" />
          </g>

          {/* La tasse */}
          <g>
            <rect x="404" y="306" width="30" height="30" rx="7" fill="#e8eaf2" opacity=".9" />
            <path d="M434 313h8a8 8 0 0 1 0 16h-8z" fill="none" stroke="#e8eaf2" strokeWidth="4" opacity=".9" />
          </g>

          {/* ------------------------------------------------------ la personne */}
          {/* Le dossier du fauteuil */}
          <rect x="246" y="150" width="150" height="190" rx="34" fill="#151a30" />

          {/* Le buste, en costume */}
          <path d="M254 336c0-58 28-94 67-94s67 36 67 94z" fill="url(#veste)" />
          {/* La chemise et la cravate */}
          <path d="M305 250l16 20 16-20 10 6-26 80-26-80z" fill="#f5f6fa" />
          <path d="M321 270l10 8-6 52-4 8-4-8-6-52z" fill="#c9a24a" />
          {/* Les revers */}
          <path d="M305 250l16 20-20 66-14-46z" fill="#2b3252" />
          <path d="M337 250l-16 20 20 66 14-46z" fill="#2b3252" />

          {/* Le cou et la tête */}
          <rect x="309" y="214" width="24" height="30" rx="12" fill="#8a5a3b" />
          <ellipse cx="321" cy="196" rx="32" ry="35" fill="#9a683f" />
          <path d="M289 190c0-22 14-34 32-34s32 12 32 34c-6-10-18-16-32-16s-26 6-32 16z" fill="#171821" />
          <circle cx="309" cy="196" r="2.6" fill="#171821" />
          <circle cx="333" cy="196" r="2.6" fill="#171821" />
          <path d="M313 210c5 4 11 4 16 0" stroke="#171821" strokeWidth="2.4" strokeLinecap="round" fill="none" />

          {/* Le bras qui tend la carte. La main s'arrête juste sous l'endroit où
              la carte est posée : c'est elle qui fixe la position de la carte. */}
          <path
            d="M352 296 Q 392 290 414 262"
            stroke="url(#veste)"
            strokeWidth="32"
            strokeLinecap="round"
            fill="none"
          />
          <ellipse cx="422" cy="256" rx="18" ry="14.5" transform="rotate(-30 422 256)" fill="#9a683f" />
        </svg>
      </div>

      {/* --------------------------------------------- la vraie carte, en main */}
      <div
        className={`absolute ${vu ? 'animate-fade-up [animation-delay:220ms]' : 'opacity-0'}`}
        style={{ left: '68%', top: '38%', width: '27%' }}
      >
        <span className="kartaa-lueur absolute inset-2 rounded-2xl bg-gold-400/30 blur-xl" />
        <div className="kartaa-flotte relative rotate-[-9deg]">
          <div className="relative overflow-hidden rounded-xl shadow-card">
            <CardScaler>
              <CardArtwork card={carte} side="back" qr={qr} />
            </CardScaler>
            {/* Le reflet qui balaie la carte : c'est le geste du scan. */}
            <span className="kartaa-reflet pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  )
}
