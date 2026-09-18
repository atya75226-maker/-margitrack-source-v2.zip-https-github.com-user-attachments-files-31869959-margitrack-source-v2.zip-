import { useEffect, useRef, useState } from 'react'
import { Icon } from '../ui/Icons'
import { prettyUrl } from '../../lib/format'
import { publicUrl } from '../../lib/slug'
import { APP } from '../../config/app.config'

/**
 * Rendu « réaliste » d'une carte, à taille fixe (1050 × 600 px).
 * Le même composant sert à la prévisualisation (mise à l'échelle par transform)
 * et à l'export PNG / JPG / PDF, pour que le fichier obtenu soit identique à l'écran.
 *
 * Répartition des deux faces :
 *   • RECTO — identité Kartaa uniquement (logo, nom de la marque). Aucun QR Code,
 *     aucune donnée du propriétaire : c'est la face « marque ».
 *   • VERSO — identité du propriétaire : son nom, éventuellement son métier, et le
 *     grand QR Code qui ouvre son profil public Kartaa.
 * Les trois modèles (standard / premium / VIP) ne changent que l'habillage :
 * mêmes informations, même structure, mêmes garanties.
 */

export const CARD_WIDTH = 1050
export const CARD_HEIGHT = 600

/**
 * Marge de sécurité pour l'impression.
 * 1050 px pour 85 mm ≈ 12,35 px/mm : 64 px valent un peu plus de 5 mm, la marge
 * habituellement demandée par les imprimeurs. Rien d'important ne sort de cette zone,
 * donc une découpe légèrement décalée ne coupe jamais le nom ni le QR Code.
 */
export const CARD_SAFE = 64

/** Coordonnées réellement renseignées, sans doublon entre téléphone et WhatsApp. */
function contactLines(card) {
  const p = card.profile || {}
  return [
    p.phone && { icon: 'phone', value: p.phone },
    p.whatsapp && p.whatsapp !== p.phone && { icon: 'whatsapp', value: p.whatsapp },
    p.email && { icon: 'mail', value: p.email },
    (p.city || p.country) && { icon: 'pin', value: [p.city, p.country].filter(Boolean).join(', ') },
  ].filter(Boolean)
}

const FONT_STACK = {
  sans: "'Plus Jakarta Sans', system-ui, sans-serif",
  display: "'Sora', 'Plus Jakarta Sans', sans-serif",
  serif: "'Fraunces', Georgia, serif",
}

function hexToRgb(hex = '#6d28d9') {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  const int = parseInt(full, 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

function shade(hex, amount) {
  const { r, g, b } = hexToRgb(hex)
  const mix = (channel) => Math.round(amount < 0 ? channel * (1 + amount) : channel + (255 - channel) * amount)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

function readableOn(hex) {
  const { r, g, b } = hexToRgb(hex)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#141728' : '#ffffff'
}

/**
 * Habillage d'un modèle : les deux faces y puisent leurs couleurs, donc le recto et
 * le verso d'une même carte restent assortis sans être dupliqués.
 */
function skinOf(template, theme) {
  if (template === 'vip') {
    return {
      background: '#0a0c18',
      text: '#ffffff',
      muted: '#8f97bb',
      soft: '#cbcfe0',
      accent: theme.accent,
      glow: `radial-gradient(75% 130% at 82% -10%, ${theme.accent}30 0%, transparent 62%)`,
      frame: `${theme.accent}55`,
      markPlate: 'rgba(255,255,255,.06)',
      markPlateBorder: `${theme.accent}66`,
    }
  }
  if (template === 'premium') {
    const text = readableOn(theme.primary)
    const light = text === '#ffffff'
    return {
      background: `linear-gradient(135deg, ${theme.primary} 0%, ${shade(theme.primary, -0.45)} 100%)`,
      text,
      muted: light ? 'rgba(255,255,255,.62)' : 'rgba(20,23,40,.6)',
      soft: light ? 'rgba(255,255,255,.86)' : 'rgba(20,23,40,.8)',
      accent: theme.accent,
      glow: `radial-gradient(55% 90% at 100% 0%, ${theme.accent}40 0%, transparent 62%)`,
      frame: light ? 'rgba(255,255,255,.28)' : 'rgba(20,23,40,.18)',
      markPlate: '#ffffff',
      markPlateBorder: 'transparent',
    }
  }
  return {
    background: '#ffffff',
    text: '#141728',
    muted: '#757ea6',
    soft: '#41486c',
    accent: theme.accent,
    glow: `radial-gradient(60% 100% at 100% 0%, ${theme.primary}0f 0%, transparent 60%)`,
    frame: `${theme.primary}26`,
    markPlate: 'transparent',
    markPlateBorder: 'transparent',
  }
}

/**
 * Photo du propriétaire.
 *
 * Une image indisponible — lien expiré, fichier supprimé, réseau coupé — ne
 * doit pas laisser un cadre vide ou une icône de fichier cassé sur une carte
 * qu'on va imprimer : elle s'efface, et la carte reste propre.
 */
function Photo({ url, borderColor, taille = 104, marge = true }) {
  const [echec, setEchec] = useState(false)
  if (!url || echec) return null
  return (
    <img
      src={url}
      alt=""
      onError={() => setEchec(true)}
      style={{ width: taille, height: taille, border: `3px solid ${borderColor}` }}
      className={`rounded-full object-cover ${marge ? 'mb-7' : ''}`}
    />
  )
}

/* ------------------------------------------------------------------ recto */

/** Logo du propriétaire. Absent, il ne laisse aucun trou : la mise en page se resserre. */
function Logo({ url, hauteur = 68 }) {
  const [echec, setEchec] = useState(false)
  if (!url || echec) return null
  return (
    <img
      src={url}
      alt=""
      onError={() => setEchec(true)}
      style={{ height: hauteur, maxWidth: 260, objectFit: 'contain' }}
    />
  )
}

/**
 * Recto : l'identité du propriétaire, et rien d'autre.
 *
 * Aucun logo n'est imposé — ni celui de Kartaa, ni un autre. Le propriétaire met
 * le sien s'il en a un, sa photo s'il le souhaite, les deux ou aucun des deux :
 * la mise en page tient dans les quatre cas.
 *
 * Le QR Code reste au verso : deux codes sur une même carte feraient hésiter
 * celui qui la scanne.
 */
function Front({ card, theme, photoUrl, logoUrl }) {
  const font = FONT_STACK[theme.font] || FONT_STACK.sans
  const template = card.template || 'standard'
  const skin = skinOf(template, theme)
  const p = card.profile || {}
  const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Votre nom'
  const profession = (p.profession || '').trim()
  const company = (card.companies?.[0]?.name || '').trim()
  const contacts = contactLines(card)
  const nameSize = fullName.length > 24 ? 44 : fullName.length > 17 ? 52 : 60

  return (
    <div
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT, fontFamily: font, background: skin.background, color: skin.text }}
      className="relative overflow-hidden"
    >
      <div style={{ background: skin.glow }} className="absolute inset-0" />
      {template === 'vip' && <div style={{ border: `1px solid ${skin.frame}` }} className="absolute inset-6 rounded-[28px]" />}
      {template === 'standard' && (
        <>
          <div style={{ background: theme.primary }} className="absolute inset-y-0 left-0 w-6" />
          <div style={{ background: theme.accent }} className="absolute bottom-0 left-6 right-0 h-2" />
        </>
      )}

      <div className="relative flex h-full flex-col justify-between" style={{ padding: CARD_SAFE }}>
        <div className="flex items-start justify-between gap-10">
          <div className="min-w-0 flex-1">
            <h1 style={{ fontSize: nameSize, fontWeight: 800, lineHeight: 1.06, letterSpacing: '-.015em' }}>
              {fullName}
            </h1>
            <div style={{ background: skin.accent }} className="mt-5 h-1 w-20 rounded-full" />
            {profession && (
              <p style={{ fontSize: 25, color: skin.soft, fontWeight: 600 }} className="mt-5 leading-snug">
                {profession.slice(0, 48)}
              </p>
            )}
            {company && (
              <p style={{ fontSize: 20, color: skin.muted }} className="mt-1.5 leading-snug">
                {company.slice(0, 44)}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-5">
            <Logo url={logoUrl} />
            <Photo url={photoUrl} borderColor={skin.accent} taille={132} marge={false} />
          </div>
        </div>

        {!!contacts.length && (
          <div className="grid grid-cols-2 gap-x-10 gap-y-3">
            {contacts.slice(0, 4).map((line) => (
              <div key={line.value} className="flex items-center gap-3" style={{ fontSize: 19, color: skin.soft }}>
                <Icon name={line.icon} size={19} style={{ color: skin.accent }} />
                <span className="truncate">{line.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ verso */

/**
 * Verso : l'identité du propriétaire et son QR Code.
 * Le nom vient du profil déjà saisi (aucune ressaisie), et le QR Code ne contient
 * qu'une URL publique — jamais une donnée personnelle, jamais un fichier.
 */
function Back({ card, theme, qr, photoUrl, logoUrl, branded = true }) {
  const font = FONT_STACK[theme.font] || FONT_STACK.sans
  const template = card.template || 'standard'
  const skin = skinOf(template, theme)
  const p = card.profile || {}
  const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Votre nom'
  // Une seule ligne professionnelle, courte : le reste vit sur le profil public.
  const profession = (p.profession || '').trim()
  const company = (card.companies?.[0]?.name || '').trim()
  const url = prettyUrl(publicUrl(card.slug || ''))
  // Le nom passe en deux tailles pour que « Jean-Baptiste Kouassi » tienne sans être coupé.
  const nameSize = fullName.length > 22 ? 46 : fullName.length > 16 ? 54 : 62

  return (
    <div
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT, fontFamily: font, background: skin.background, color: skin.text }}
      className="relative overflow-hidden"
    >
      <div style={{ background: skin.glow }} className="absolute inset-0" />
      {template === 'vip' && <div style={{ border: `1px solid ${skin.frame}` }} className="absolute inset-6 rounded-[28px]" />}
      {template === 'standard' && <div style={{ background: theme.primary }} className="absolute inset-x-0 top-0 h-3" />}

      <div className="relative flex h-full items-center gap-12" style={{ padding: CARD_SAFE }}>
        {/* ------------------------------------------------ identité */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          {/* Logo et photo sont facultatifs et indépendants : la colonne se
              resserre d'elle-même quand l'un des deux manque, ou les deux. */}
          {(logoUrl || photoUrl) && (
            <div className="mb-7 flex items-center gap-5">
              <Photo url={photoUrl} borderColor={skin.accent} marge={false} />
              <Logo url={logoUrl} hauteur={56} />
            </div>
          )}
          <h1 style={{ fontSize: nameSize, fontWeight: 800, lineHeight: 1.06, letterSpacing: '-.015em' }}>{fullName}</h1>
          <div style={{ background: skin.accent }} className="mt-6 h-1 w-20 rounded-full" />
          {profession && (
            <p style={{ fontSize: 26, color: skin.soft, fontWeight: 600 }} className="mt-6 leading-snug">
              {profession.slice(0, 48)}
            </p>
          )}
          {company && (
            <p style={{ fontSize: 21, color: skin.muted }} className="mt-2 leading-snug">
              {company.slice(0, 44)}
            </p>
          )}
          {branded && (
            <p style={{ fontSize: 15, color: skin.muted }} className="mt-10 font-medium">
              Créé avec Kartaa
            </p>
          )}
        </div>

        {/* ------------------------------------------------ QR Code */}
        <div className="flex w-[372px] shrink-0 flex-col items-center gap-5 text-center">
          {/* Fond blanc et marge autour du code : deux conditions pour qu'un téléphone
              le lise du premier coup, y compris sur les modèles sombres. */}
          <div
            className="rounded-3xl bg-white"
            style={{ padding: 18, boxShadow: template === 'standard' ? '0 20px 40px -22px rgba(10,12,24,.35)' : 'none' }}
          >
            {qr ? <img src={qr} alt="QR Code" style={{ width: 300, height: 300, display: 'block' }} /> : <div style={{ width: 300, height: 300 }} />}
          </div>
          <p style={{ fontSize: 20, fontWeight: 700 }} className="whitespace-nowrap">Scannez pour voir mon profil</p>
          <p style={{ fontSize: 16, color: skin.muted }} className="truncate max-w-full">{url}</p>
        </div>
      </div>
    </div>
  )
}

export function CardArtwork({ card, side = 'front', qr, photoUrl, logoUrl, branded = true }) {
  const theme = { primary: '#6d28d9', accent: '#f5b229', font: 'sans', layout: 'left', ...(card.theme || {}) }
  return side === 'back'
    ? <Back card={card} theme={theme} qr={qr} photoUrl={photoUrl} logoUrl={logoUrl} branded={branded} />
    : <Front card={card} theme={theme} photoUrl={photoUrl} logoUrl={logoUrl} />
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
