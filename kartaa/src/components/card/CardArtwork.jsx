import { useEffect, useRef, useState } from 'react'
import { APP } from '../../config/app.config'

/**
 * Rendu d'une carte Kartaa, à taille fixe (1050 × 600 px).
 * Le même composant sert à la prévisualisation (mise à l'échelle par transform)
 * et à l'export PNG / JPG / PDF : le fichier obtenu est exactement ce qu'on voyait.
 *
 * LA CARTE NE CONTIENT PAS L'IDENTITÉ, ELLE Y DONNE ACCÈS
 *
 *   • RECTO — le nom de la marque, et rien d'autre.
 *   • VERSO — le QR Code, et rien d'autre.
 *
 * Aucune donnée du propriétaire n'entre ici : ni nom, ni photo, ni logo, ni
 * téléphone, ni métier. Ces informations continuent d'exister — dans le profil,
 * dans la base, sur le mini-site public — mais elles ne sont plus imprimées.
 * C'est le mini-site qui les porte ; la carte ne porte que le chemin vers lui.
 *
 * Cette séparation est volontaire et tenue par le code : ce composant ne lit du
 * `card` que son modèle. Une modification du profil ne peut donc plus déplacer
 * quoi que ce soit sur la carte, ni y faire réapparaître une information.
 *
 * Les trois modèles ne changent que l'habillage : fond, typographie, traitement
 * du nom. Tous suivent la même règle — recto « Kartaa », verso QR Code.
 *
 * LE FILIGRANE DE L'OFFRE GRATUITE
 *
 * Une carte gratuite porte au verso, sous le QR Code, une ligne « Powered by
 * Kartaa ». Elle disparaît avec l'abonnement Pro. Elle tient dans la marge de
 * sécurité, ne touche ni le QR Code ni sa zone calme, et reste assez petite
 * pour passer pour une mention d'éditeur — jamais un bandeau en travers de la
 * carte.
 *
 * Elle ne va qu'au verso : le recto porte déjà le nom Kartaa en grand, qui est
 * le dessin même de la carte et reste identique dans les deux offres. Ce que le
 * Pro retire, c'est la mention AJOUTÉE, pas l'identité de la carte.
 *
 * `filigrane` est décidé par l'appelant à partir du plan effectif, lui-même lu
 * dans une colonne que le navigateur ne peut pas écrire (déclencheur
 * protect_plan_column) et dont l'échéance est vérifiée. Voir la note dans
 * CardDetailPage sur ce que cette protection couvre et ne couvre pas.
 */

export const CARD_WIDTH = 1050
export const CARD_HEIGHT = 600

/**
 * Marge de sécurité pour l'impression.
 * 1050 px pour 85 mm ≈ 12,35 px/mm : 64 px valent un peu plus de 5 mm, la marge
 * habituellement demandée par les imprimeurs. Ni le nom ni le QR Code n'en
 * sortent, donc une découpe légèrement décalée ne les entame jamais.
 */
export const CARD_SAFE = 64

const POLICES = {
  display: "'Sora', 'Plus Jakarta Sans', system-ui, sans-serif",
  sans: "'Plus Jakarta Sans', system-ui, sans-serif",
  serif: "'Fraunces', Georgia, serif",
}

/**
 * Les trois habillages, figés ici.
 *
 * Ils ne dépendent d'aucun réglage du propriétaire : c'est ce qui garantit
 * qu'une carte Standard ressemble toujours à une carte Standard. Les couleurs
 * choisies dans l'assistant habillent le mini-site public, pas la carte.
 */
const MODELES = {
  // Bleu nuit franc : sobre, professionnel, lisible de loin.
  standard: {
    fond: 'linear-gradient(145deg, #27334f 0%, #1d2740 55%, #161e33 100%)',
    voile: 'radial-gradient(120% 150% at 0% 0%, rgba(255,255,255,.07) 0%, transparent 58%)',
    marque: {
      police: POLICES.display,
      taille: 96,
      graisse: 600,
      espacement: '.01em',
      couleur: '#ffffff',
    },
  },
  // Noir satiné : le même dépouillement, une lumière rasante en plus.
  premium: {
    fond: 'linear-gradient(150deg, #17181c 0%, #0d0e11 48%, #0a0b0e 100%)',
    voile: 'linear-gradient(118deg, transparent 32%, rgba(255,255,255,.055) 46%, rgba(255,255,255,.015) 54%, transparent 66%)',
    marque: {
      police: POLICES.display,
      taille: 94,
      graisse: 400,
      espacement: '.05em',
      couleur: '#ffffff',
    },
  },
  // Noir profond cerné d'or : tout tient dans le liseré et le nom.
  vip: {
    fond: 'linear-gradient(150deg, #101013 0%, #08080b 52%, #050507 100%)',
    voile: 'radial-gradient(85% 130% at 50% -18%, rgba(226,194,116,.12) 0%, transparent 60%)',
    // Le liseré épouse le bord de la carte : arrondi par le cadre qui l'affiche,
    // droit sur le fichier imprimé, où les angles sont coupés au massicot.
    cadre: { epaisseur: 9, couleur: '#c9a24a' },
    marque: {
      police: POLICES.display,
      taille: 92,
      graisse: 500,
      espacement: '.06em',
      couleur: '#e2c274',
      // L'or est un dégradé découpé dans le texte. Si le navigateur ne sait pas
      // le faire, `couleur` reste visible : jamais de nom invisible.
      or: 'linear-gradient(101deg, #f6e4b0 0%, #d3a54c 42%, #f7e6b6 63%, #c69a42 100%)',
    },
  },
}

function habillage(template) {
  return MODELES[template] || MODELES.standard
}

/**
 * Mention de l'offre gratuite, au verso.
 *
 * Posée dans la marge de sécurité (`CARD_SAFE`), donc à l'abri du massicot, et
 * sous la plaque du QR Code, qu'elle ne chevauche jamais : la plaque s'arrête à
 * 486 px du haut, cette ligne commence 30 px plus bas.
 *
 * L'or du modèle VIP reprend la teinte du liseré ; les deux autres restent en
 * blanc très atténué. Dans tous les cas la mention se lit de près et s'efface
 * de loin, ce qui est exactement son rôle.
 */
function Filigrane({ modele }) {
  const couleur = modele.cadre ? 'rgba(201,162,74,.66)' : 'rgba(255,255,255,.44)'
  return (
    <div
      className="absolute inset-x-0 flex justify-center"
      style={{ bottom: CARD_SAFE }}
    >
      <span
        style={{
          fontFamily: POLICES.sans,
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: '.22em',
          textTransform: 'uppercase',
          color: couleur,
          lineHeight: 1,
        }}
      >
        Powered by {APP.name}
      </span>
    </div>
  )
}

/** Liseré du modèle, le long du bord. Les modèles qui n'en ont pas n'en dessinent aucun. */
function Cadre({ modele }) {
  if (!modele.cadre) return null
  return (
    <div
      className="absolute inset-0"
      style={{ border: `${modele.cadre.epaisseur}px solid ${modele.cadre.couleur}` }}
    />
  )
}

/** Le nom de la marque, tel qu'il est défini une seule fois dans la configuration. */
function Marque({ modele }) {
  const { marque } = modele
  const or = marque.or
    ? { backgroundImage: marque.or, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }
    : null
  return (
    <span
      style={{
        fontFamily: marque.police,
        fontSize: marque.taille,
        fontWeight: marque.graisse,
        letterSpacing: marque.espacement,
        color: marque.couleur,
        lineHeight: 1,
        // Un espacement de lettres décale le texte vers la droite : on compense
        // pour que le nom reste optiquement centré.
        paddingLeft: marque.espacement.startsWith('.') ? marque.espacement : 0,
        ...or,
      }}
    >
      {APP.name}
    </span>
  )
}

/* ------------------------------------------------------------------ recto */

/** Recto : le nom de la marque, centré, seul. */
function Recto({ modele }) {
  return (
    <div
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT, background: modele.fond }}
      className="relative overflow-hidden"
    >
      <div style={{ background: modele.voile }} className="absolute inset-0" />
      <Cadre modele={modele} />
      <div className="relative grid h-full place-items-center" style={{ padding: CARD_SAFE }}>
        <Marque modele={modele} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ verso */

/**
 * Verso : le QR Code, centré, seul.
 *
 * Aucun texte, aucune adresse, aucune invitation à scanner : un QR Code se
 * reconnaît sans légende. Ce qu'il contient reste une simple adresse publique —
 * jamais une donnée personnelle, jamais un fichier.
 */
function Verso({ modele, qr, filigrane }) {
  // 328 px de code sur 1050, soit environ 26 mm sur une carte de 85 mm : bien
  // au-dessus des 20 mm en dessous desquels un téléphone commence à peiner.
  const cote = 372
  const marge = 22
  return (
    <div
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT, background: modele.fond }}
      className="relative overflow-hidden"
    >
      <div style={{ background: modele.voile }} className="absolute inset-0" />
      <Cadre modele={modele} />
      <div className="relative grid h-full place-items-center" style={{ padding: CARD_SAFE }}>
        {/* La plaque blanche et sa marge forment la zone calme du code : sans
            elle, aucun de ces fonds sombres ne se laisserait scanner. La
            lisibilité passe avant l'esthétique, sur les trois modèles. */}
        <div
          style={{
            width: cote,
            height: cote,
            padding: marge,
            background: '#ffffff',
            boxShadow: '0 30px 64px -38px rgba(0,0,0,.85)',
            borderRadius: 18,
          }}
        >
          {qr ? (
            <img
              src={qr}
              alt="QR Code"
              style={{ width: cote - marge * 2, height: cote - marge * 2, display: 'block' }}
            />
          ) : (
            <div style={{ width: cote - marge * 2, height: cote - marge * 2 }} />
          )}
        </div>
      </div>
      {filigrane && <Filigrane modele={modele} />}
    </div>
  )
}

/**
 * `qr` est la seule chose qui vienne du dehors : l'image du code, calculée à
 * partir de l'adresse publique de la carte. Tout le reste est décidé ici.
 */
export function CardArtwork({ card, side = 'front', qr, filigrane = false }) {
  const modele = habillage(card?.template || 'standard')
  return side === 'back'
    ? <Verso modele={modele} qr={qr} filigrane={filigrane} />
    : <Recto modele={modele} />
}

/** Conteneur responsive : met la carte à l'échelle sans déformer le rendu. */
export function CardScaler({ children, width = CARD_WIDTH, height = CARD_HEIGHT, maxWidth, className = '' }) {
  const ref = useRef(null)
  const [available, setAvailable] = useState(maxWidth || width)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const measure = () => {
      const box = node.getBoundingClientRect().width || width
      setAvailable(Math.min(box, maxWidth || box))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [width, maxWidth])

  const scale = available / width
  return (
    <div ref={ref} className={`w-full ${className}`} style={{ height: height * scale }}>
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  )
}
