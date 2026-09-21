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
 * LES FILIGRANES DE L'OFFRE GRATUITE
 *
 * Une carte gratuite porte, sur SES DEUX FACES, un semis de « Kartaa » répété
 * en diagonale, plus une mention « Powered by Kartaa » en bas. Tout cela
 * disparaît avec l'abonnement Pro.
 *
 * Le semis est volontairement nombreux et lisible : une mention trop timide ne
 * se voyait pas une fois la carte réduite à la taille d'un téléphone, et ne
 * remplissait donc pas son rôle. Il reste néanmoins sous le contenu, jamais
 * par-dessus, et son intensité tient dans une seule constante — `FILIGRANE` —
 * pour se régler d'un seul endroit.
 *
 * LA RÈGLE QUI NE PLIE PAS : LE QR CODE RESTE SCANNABLE.
 *
 * Au verso, le semis est dessiné AVANT la plaque blanche du code, donc
 * derrière elle. La plaque est opaque : ni le code ni sa zone calme ne sont
 * jamais recouverts, quelle que soit l'intensité choisie. Un filigrane qui
 * empêcherait de scanner ne serait pas un filigrane, ce serait une panne.
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
 * Réglages des filigranes, en un seul endroit.
 *
 * `opacite` est le seul curseur à toucher pour les rendre plus ou moins
 * présents ; le reste décrit la grille du semis.
 */
const FILIGRANE = {
  texte: 32,        // taille du mot répété
  mention: 26,      // taille de la ligne « Powered by Kartaa »
  opacite: 0.12,    // semis, sur fond sombre
  opaciteMention: 0.5,
  angle: -24,       // pente du semis
  pasX: 300,        // écart horizontal entre deux mots
  pasY: 132,        // écart vertical entre deux rangées
}

/** Teinte des filigranes : l'or du liseré sur le modèle VIP, le blanc ailleurs. */
function teinte(modele, opacite) {
  return modele.cadre
    ? `rgba(201,162,74,${opacite + 0.04})`
    : `rgba(255,255,255,${opacite})`
}

/**
 * Le semis de « Kartaa », répété en diagonale sur toute la face.
 *
 * La grille est calculée pour couvrir la carte même après rotation : on dessine
 * sur une surface plus large que la carte, centrée, et le `overflow-hidden` de
 * la face coupe ce qui dépasse. Les rangées impaires sont décalées d'un demi-pas
 * pour éviter l'effet de colonnes.
 *
 * Il est posé SOUS le contenu : au recto le nom reste net, au verso la plaque
 * blanche du QR Code le masque entièrement.
 */
function SemisFiligrane({ modele }) {
  const largeur = CARD_WIDTH * 1.55
  const hauteur = CARD_HEIGHT * 1.75
  const colonnes = Math.ceil(largeur / FILIGRANE.pasX) + 1
  const rangees = Math.ceil(hauteur / FILIGRANE.pasY) + 1
  const couleur = teinte(modele, FILIGRANE.opacite)

  const mots = []
  for (let rangee = 0; rangee < rangees; rangee += 1) {
    for (let colonne = 0; colonne < colonnes; colonne += 1) {
      mots.push(
        <span
          key={`${rangee}-${colonne}`}
          style={{
            position: 'absolute',
            left: colonne * FILIGRANE.pasX + (rangee % 2 ? FILIGRANE.pasX / 2 : 0),
            top: rangee * FILIGRANE.pasY,
            fontFamily: POLICES.display,
            fontSize: FILIGRANE.texte,
            fontWeight: 700,
            letterSpacing: '.2em',
            color: couleur,
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}
        >
          {APP.name}
        </span>,
      )
    }
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: (CARD_WIDTH - largeur) / 2,
        top: (CARD_HEIGHT - hauteur) / 2,
        width: largeur,
        height: hauteur,
        transform: `rotate(${FILIGRANE.angle}deg)`,
      }}
    >
      {mots}
    </div>
  )
}

/**
 * La mention « Powered by Kartaa », en bas de face.
 *
 * Posée dans la marge de sécurité (`CARD_SAFE`), donc à l'abri du massicot, et
 * sous la plaque du QR Code au verso : la plaque s'arrête à 486 px du haut,
 * cette ligne commence plus bas.
 */
function MentionFiligrane({ modele }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 flex justify-center"
      style={{ bottom: CARD_SAFE - 8 }}
    >
      <span
        style={{
          fontFamily: POLICES.sans,
          fontSize: FILIGRANE.mention,
          fontWeight: 700,
          letterSpacing: '.22em',
          textTransform: 'uppercase',
          color: teinte(modele, FILIGRANE.opaciteMention),
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

/**
 * Recto : le nom de la marque, centré, seul.
 *
 * En offre gratuite s'y ajoutent le semis et la mention — posés avant le nom,
 * donc derrière lui : le nom de marque reste net, sans quoi le recto perdrait
 * ce qui en fait une carte.
 */
function Recto({ modele, filigrane }) {
  return (
    <div
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT, background: modele.fond }}
      className="relative overflow-hidden"
    >
      <div style={{ background: modele.voile }} className="absolute inset-0" />
      {filigrane && <SemisFiligrane modele={modele} />}
      <Cadre modele={modele} />
      <div className="relative grid h-full place-items-center" style={{ padding: CARD_SAFE }}>
        <Marque modele={modele} />
      </div>
      {filigrane && <MentionFiligrane modele={modele} />}
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
      {/* Le semis vient AVANT la plaque du code : il passe donc derrière elle.
          La plaque étant opaque, ni le code ni sa zone calme ne sont jamais
          recouverts — le filigrane ne peut pas empêcher de scanner. */}
      {filigrane && <SemisFiligrane modele={modele} />}
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
      {filigrane && <MentionFiligrane modele={modele} />}
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
    : <Recto modele={modele} filigrane={filigrane} />
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
