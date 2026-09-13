import { useEffect, useRef, useState } from 'react'
import { Icon, SocialIcon } from '../ui/Icons'
import { initialsOf, prettyUrl } from '../../lib/format'
import { publicUrl } from '../../lib/slug'
import { distinctPlatforms, activeLinks } from '../../lib/socialLinks'

/**
 * Rendu « réaliste » d'une carte, à taille fixe (1050 × 600 px).
 * Le même composant sert à la prévisualisation (mise à l'échelle par transform)
 * et à l'export PNG / JPG / PDF, pour que le fichier obtenu soit identique à l'écran.
 */

export const CARD_WIDTH = 1050
export const CARD_HEIGHT = 600

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

function contactLines(card) {
  const p = card.profile || {}
  return [
    p.phone && { icon: 'phone', value: p.phone },
    p.whatsapp && p.whatsapp !== p.phone && { icon: 'whatsapp', value: p.whatsapp },
    p.email && { icon: 'mail', value: p.email },
    (p.city || p.country) && { icon: 'pin', value: [p.city, p.country].filter(Boolean).join(', ') },
  ].filter(Boolean)
}

/** Sur la carte, une icône par plateforme : pas de doublon même avec dix comptes. */
function socialList(card) {
  return distinctPlatforms(card.socialLinks).map((network) => ({ key: network.key }))
}

/* ------------------------------------------------------------------ recto */

function Front({ card, theme, photoUrl, logoUrl, qr }) {
  const p = card.profile || {}
  const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Votre nom'
  const font = FONT_STACK[theme.font] || FONT_STACK.sans
  const template = card.template || 'standard'
  const contacts = contactLines(card)
  const socials = socialList(card)

  if (template === 'vip') {
    return (
      <div style={{ width: CARD_WIDTH, height: CARD_HEIGHT, fontFamily: font, background: '#0a0c18', color: '#fff' }} className="relative overflow-hidden">
        <div style={{ background: `radial-gradient(70% 120% at 85% 0%, ${theme.accent}33 0%, transparent 60%)` }} className="absolute inset-0" />
        <div style={{ border: `1px solid ${theme.accent}55` }} className="absolute inset-6 rounded-[28px]" />
        <div className="relative flex h-full items-center gap-12 px-16">
          <div className="flex-1">
            <div style={{ color: theme.accent, letterSpacing: '.32em' }} className="mb-5 text-[15px] font-bold uppercase">
              {(card.companies?.[0]?.name || p.profession || 'Carte VIP').slice(0, 26)}
            </div>
            <h1 style={{ fontSize: 62, lineHeight: 1.03, fontWeight: 600 }} className="mb-4">{fullName}</h1>
            <div style={{ background: theme.accent }} className="mb-6 h-px w-24" />
            <p style={{ fontSize: 23, color: '#cbcfe0' }} className="mb-8">{p.profession || 'Votre activité'}</p>
            <div className="space-y-3">
              {contacts.slice(0, 3).map((line) => (
                <div key={line.value} className="flex items-center gap-3" style={{ fontSize: 20, color: '#e8eaf2' }}>
                  <Icon name={line.icon} size={21} style={{ color: theme.accent }} />
                  <span>{line.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center gap-6">
            {photoUrl ? (
              <img src={photoUrl} alt="" style={{ width: 168, height: 168, border: `2px solid ${theme.accent}` }} className="rounded-full object-cover" />
            ) : (
              <div style={{ width: 168, height: 168, border: `2px solid ${theme.accent}`, color: theme.accent, fontSize: 56 }} className="grid place-items-center rounded-full font-semibold">
                {initialsOf(p.firstName, p.lastName)}
              </div>
            )}
            <div className="rounded-2xl bg-white p-3">
              {qr ? <img src={qr} alt="QR Code" style={{ width: 132, height: 132 }} /> : <div style={{ width: 132, height: 132 }} />}
            </div>
            <span style={{ fontSize: 15, color: '#757ea6' }}>{prettyUrl(publicUrl(card.slug || ''))}</span>
          </div>
        </div>
      </div>
    )
  }

  if (template === 'premium') {
    const text = readableOn(theme.primary)
    return (
      <div
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          fontFamily: font,
          background: `linear-gradient(135deg, ${theme.primary} 0%, ${shade(theme.primary, -0.45)} 100%)`,
          color: text,
        }}
        className="relative overflow-hidden"
      >
        <div style={{ background: `radial-gradient(50% 80% at 100% 0%, ${theme.accent}44 0%, transparent 60%)` }} className="absolute inset-0" />
        <div className="relative flex h-full flex-col justify-between px-16 py-14">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              {photoUrl ? (
                <img src={photoUrl} alt="" style={{ width: 130, height: 130, border: `3px solid ${theme.accent}` }} className="rounded-3xl object-cover" />
              ) : (
                <div style={{ width: 130, height: 130, background: 'rgba(255,255,255,.16)', fontSize: 46 }} className="grid place-items-center rounded-3xl font-bold">
                  {initialsOf(p.firstName, p.lastName)}
                </div>
              )}
              <div>
                <h1 style={{ fontSize: 52, lineHeight: 1.05, fontWeight: 800 }}>{fullName}</h1>
                <p style={{ fontSize: 24, color: theme.accent, fontWeight: 600 }} className="mt-2">{p.profession || 'Votre activité'}</p>
                {card.companies?.[0]?.name && (
                  <p style={{ fontSize: 19, opacity: 0.78 }} className="mt-1">{card.companies[0].name}</p>
                )}
              </div>
            </div>
            {logoUrl && <img src={logoUrl} alt="" style={{ height: 64 }} className="rounded-xl bg-white/90 p-2" />}
          </div>

          <div className="flex items-end justify-between gap-10">
            <div className="space-y-3.5">
              {contacts.map((line) => (
                <div key={line.value} className="flex items-center gap-3.5" style={{ fontSize: 21 }}>
                  <span style={{ background: 'rgba(255,255,255,.16)' }} className="grid h-10 w-10 place-items-center rounded-xl">
                    <Icon name={line.icon} size={20} />
                  </span>
                  <span>{line.value}</span>
                </div>
              ))}
              {!!socials.length && (
                <div className="flex items-center gap-3 pt-2">
                  {socials.slice(0, 6).map((social) => (
                    <span key={social.key} style={{ background: 'rgba(255,255,255,.16)' }} className="grid h-10 w-10 place-items-center rounded-xl">
                      <SocialIcon network={social.key} size={19} />
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-2xl bg-white p-3.5">
                {qr ? <img src={qr} alt="QR Code" style={{ width: 152, height: 152 }} /> : <div style={{ width: 152, height: 152 }} />}
              </div>
              <span style={{ fontSize: 15, opacity: 0.8 }}>Scannez-moi</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* standard */
  return (
    <div style={{ width: CARD_WIDTH, height: CARD_HEIGHT, fontFamily: font, background: '#fff', color: '#141728' }} className="relative overflow-hidden">
      <div style={{ background: theme.primary }} className="absolute inset-y-0 left-0 w-6" />
      <div style={{ background: theme.accent }} className="absolute bottom-0 left-6 h-2 w-full" />
      <div className="relative flex h-full items-center justify-between gap-10 px-20 py-14">
        <div className="flex-1">
          <div className="mb-8 flex items-center gap-6">
            {photoUrl ? (
              <img src={photoUrl} alt="" style={{ width: 126, height: 126, border: `4px solid ${theme.primary}` }} className="rounded-full object-cover" />
            ) : (
              <div style={{ width: 126, height: 126, background: `${theme.primary}18`, color: theme.primary, fontSize: 44 }} className="grid place-items-center rounded-full font-bold">
                {initialsOf(p.firstName, p.lastName)}
              </div>
            )}
            <div>
              <h1 style={{ fontSize: 50, lineHeight: 1.05, fontWeight: 800 }}>{fullName}</h1>
              <p style={{ fontSize: 23, color: theme.primary, fontWeight: 700 }} className="mt-1.5">{p.profession || 'Votre activité'}</p>
              {card.companies?.[0]?.name && <p style={{ fontSize: 19, color: '#545d88' }} className="mt-1">{card.companies[0].name}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {contacts.map((line) => (
              <div key={line.value} className="flex items-center gap-3" style={{ fontSize: 19, color: '#353a57' }}>
                <Icon name={line.icon} size={20} style={{ color: theme.primary }} />
                <span className="truncate">{line.value}</span>
              </div>
            ))}
          </div>
          {!!socials.length && (
            <div className="mt-7 flex items-center gap-3">
              {socials.slice(0, 7).map((social) => (
                <span key={social.key} style={{ background: `${theme.primary}12`, color: theme.primary }} className="grid h-10 w-10 place-items-center rounded-xl">
                  <SocialIcon network={social.key} size={19} />
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-3">
          {logoUrl && <img src={logoUrl} alt="" style={{ height: 52 }} className="mb-1" />}
          <div style={{ border: `2px solid ${theme.primary}22` }} className="rounded-2xl p-3">
            {qr ? <img src={qr} alt="QR Code" style={{ width: 158, height: 158 }} /> : <div style={{ width: 158, height: 158 }} />}
          </div>
          <span style={{ fontSize: 15, color: '#757ea6' }}>{prettyUrl(publicUrl(card.slug || ''))}</span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ verso */

function Back({ card, theme, qr, branded = true }) {
  const font = FONT_STACK[theme.font] || FONT_STACK.sans
  const dark = card.template === 'vip'
  // Le verso détaille les liens : on y montre les noms donnés par l'utilisateur.
  const detail = activeLinks(card.socialLinks)
  return (
    <div
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        fontFamily: font,
        background: dark ? '#0a0c18' : '#fff',
        color: dark ? '#fff' : '#141728',
      }}
      className="relative overflow-hidden"
    >
      <div style={{ background: theme.primary }} className="absolute inset-x-0 top-0 h-3" />
      <div className="flex h-full gap-12 px-16 pb-12 pt-16">
        <div className="flex-1">
          {card.about && (
            <>
              <h2 style={{ fontSize: 17, letterSpacing: '.18em', color: theme.primary === '#141728' ? theme.accent : theme.primary }} className="mb-3 font-bold uppercase">
                À propos
              </h2>
              <p style={{ fontSize: 20, lineHeight: 1.55, color: dark ? '#cbcfe0' : '#41486c' }} className="mb-8">
                {card.about.slice(0, 320)}
              </p>
            </>
          )}
          {!!card.activities?.length && (
            <>
              <h2 style={{ fontSize: 17, letterSpacing: '.18em', color: theme.primary === '#141728' ? theme.accent : theme.primary }} className="mb-3 font-bold uppercase">
                Mes activités
              </h2>
              <div className="flex flex-wrap gap-2.5">
                {card.activities.slice(0, 8).map((activity) => (
                  <span
                    key={activity}
                    style={{ background: dark ? 'rgba(255,255,255,.08)' : `${theme.primary}12`, color: dark ? '#e8eaf2' : theme.primary, fontSize: 18 }}
                    className="rounded-full px-4 py-2 font-semibold"
                  >
                    {activity}
                  </span>
                ))}
              </div>
            </>
          )}
          {!!detail.length && (
            <div className="mt-8 space-y-2.5">
              {detail.slice(0, 5).map((link) => (
                <div key={link.id || link.uid || link.url} className="flex items-center gap-3" style={{ fontSize: 18, color: dark ? '#cbcfe0' : '#41486c' }}>
                  <SocialIcon network={link.platform} size={19} />
                  <span className="truncate">{link.title?.trim() || prettyUrl(link.url)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex w-[300px] flex-col items-center justify-center gap-5 text-center">
          <div className="rounded-3xl bg-white p-4" style={{ boxShadow: dark ? 'none' : '0 20px 40px -20px rgba(10,12,24,.35)' }}>
            {qr ? <img src={qr} alt="QR Code" style={{ width: 210, height: 210 }} /> : <div style={{ width: 210, height: 210 }} />}
          </div>
          <p style={{ fontSize: 19, fontWeight: 700 }}>Scannez pour découvrir mon profil</p>
          <p style={{ fontSize: 16, color: dark ? '#757ea6' : '#757ea6' }}>{prettyUrl(publicUrl(card.slug || ''))}</p>
          {branded && <p style={{ fontSize: 14, color: '#a3a9c6' }} className="mt-2">Créé avec Kartaa</p>}
        </div>
      </div>
    </div>
  )
}

export function CardArtwork({ card, side = 'front', qr, photoUrl, logoUrl, branded = true }) {
  const theme = { primary: '#6d28d9', accent: '#f5b229', font: 'sans', layout: 'left', ...(card.theme || {}) }
  return side === 'back'
    ? <Back card={card} theme={theme} qr={qr} branded={branded} />
    : <Front card={card} theme={theme} qr={qr} photoUrl={photoUrl} logoUrl={logoUrl} />
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
