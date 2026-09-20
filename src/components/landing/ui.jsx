import React, { useEffect, useRef, useState } from "react";

/**
 * Briques visuelles de la page d'accueil publique.
 *
 * Tout prend la palette en paramètre (`c`) plutôt que de lire un thème
 * global : la page vitrine choisit son thème elle-même, indépendamment de
 * celui qu'un utilisateur connecté aurait enregistré dans l'application.
 */

/** Apparition au défilement. Sans JavaScript actif, le contenu reste visible. */
export function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return undefined;
    }
    // Une seule apparition : réanimer à chaque passage donnerait le mal de mer.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(18px)",
        transition: `opacity 700ms ease ${delay}ms, transform 700ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export function Section({ id, children, className = "", style, wide = false }) {
  return (
    <section id={id} className={`px-5 sm:px-6 ${className}`} style={style}>
      <div className={`${wide ? "max-w-6xl" : "max-w-5xl"} mx-auto`}>{children}</div>
    </section>
  );
}

export function Eyebrow({ c, children }) {
  return (
    <p
      className="text-[11px] font-bold uppercase tracking-[0.14em] mb-3"
      style={{ color: c.violet }}
    >
      {children}
    </p>
  );
}

export function Title({ c, children, className = "" }) {
  return (
    <h2
      className={`text-[26px] leading-tight sm:text-4xl font-bold font-display ${className}`}
      style={{ color: c.ink }}
    >
      {children}
    </h2>
  );
}

export function Lead({ c, children, className = "" }) {
  return (
    <p className={`text-[15px] sm:text-base leading-relaxed ${className}`} style={{ color: c.muted }}>
      {children}
    </p>
  );
}

export function SectionHead({ c, eyebrow, title, lead, center = true }) {
  return (
    <div className={`${center ? "text-center max-w-2xl mx-auto" : "max-w-2xl"} mb-10`}>
      {eyebrow && <Eyebrow c={c}>{eyebrow}</Eyebrow>}
      <Title c={c}>{title}</Title>
      {lead && <Lead c={c} className="mt-4">{lead}</Lead>}
    </div>
  );
}

export function Card({ c, children, className = "", style }) {
  return (
    <div
      className={`rounded-3xl ${className}`}
      style={{ backgroundColor: c.card, border: `1px solid ${c.line}`, ...style }}
    >
      {children}
    </div>
  );
}

/** Bouton d'action principal. Rendu en <button> : il déclenche la navigation interne. */
export function PrimaryButton({ c, children, onClick, className = "", size = "lg" }) {
  const pad = size === "lg" ? "px-7 py-3.5 text-[15px]" : "px-4 py-2 text-sm";
  return (
    <button
      onClick={onClick}
      className={`rounded-full font-semibold text-white transition-transform duration-200 active:scale-[0.98] ${pad} ${className}`}
      style={{
        background: `linear-gradient(135deg, ${c.violet}, ${c.violetDeep})`,
        boxShadow: `0 10px 24px ${c.glow}`,
      }}
    >
      {children}
    </button>
  );
}

export function GhostButton({ c, children, onClick, href, className = "", size = "lg" }) {
  const pad = size === "lg" ? "px-7 py-3.5 text-[15px]" : "px-4 py-2 text-sm";
  const style = {
    borderColor: c.line,
    color: c.ink,
    backgroundColor: c.card,
  };
  const classes = `rounded-full font-semibold border text-center transition-colors ${pad} ${className}`;
  return href ? (
    <a href={href} className={classes} style={style}>{children}</a>
  ) : (
    <button onClick={onClick} className={classes} style={style}>{children}</button>
  );
}

export function Check({ c, size = 18 }) {
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center rounded-full mt-0.5"
      style={{ width: size, height: size, backgroundColor: c.softGreen, color: c.green }}
    >
      <svg viewBox="0 0 24 24" width={size - 6} height={size - 6} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

/**
 * Capture d'écran de l'application, déclinée dans les deux thèmes.
 *
 * Ce sont de vraies captures des écrans de Margitrack, prises sur les
 * composants de l'application : rien n'est redessiné pour la vitrine.
 */
export function Screenshot({ name, theme, alt, className = "", style, priority = false }) {
  return (
    <img
      src={`/images/app/${name}-${theme}.png`}
      alt={alt}
      // La capture du haut de page est la première chose que le visiteur
      // regarde : la différer retarderait l'affichage utile. Les suivantes
      // n'arrivent qu'au moment où l'on descend jusqu'à elles.
      loading={priority ? "eager" : "lazy"}
      fetchpriority={priority ? "high" : undefined}
      decoding="async"
      className={`block w-full h-auto ${className}`}
      style={style}
    />
  );
}

/** Téléphone tenant une capture de l'application. */
export function PhoneFrame({ c, name, theme, alt, className = "", maxWidth = 300, priority = false }) {
  return (
    <div className={`mx-auto ${className}`} style={{ maxWidth }}>
      <div
        className="rounded-[2.2rem] p-2.5"
        style={{
          backgroundColor: c.name === "light" ? "#20232F" : "#05060C",
          border: `1px solid ${c.name === "light" ? "#2C3040" : "#242A3D"}`,
          boxShadow: c.shadow,
        }}
      >
        <div className="rounded-[1.7rem] overflow-hidden relative" style={{ backgroundColor: c.bg }}>
          {/* Encoche : suffit à faire lire « téléphone » sans dessiner un appareil entier. */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 rounded-b-xl"
               style={{ width: 86, height: 16, backgroundColor: c.name === "light" ? "#20232F" : "#05060C" }} />
          <Screenshot name={name} theme={theme} alt={alt} priority={priority} />
        </div>
      </div>
    </div>
  );
}

/** Fenêtre de navigateur tenant une capture, pour les écrans larges. */
export function WindowFrame({ c, children, className = "" }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden ${className}`}
      style={{ border: `1px solid ${c.line}`, boxShadow: c.shadow, backgroundColor: c.card }}
    >
      <div className="flex items-center gap-1.5 px-3 py-2.5" style={{ backgroundColor: c.elevated }}>
        {["#F87171", "#FBBF24", "#34D399"].map((dot) => (
          <span key={dot} className="rounded-full" style={{ width: 9, height: 9, backgroundColor: dot }} />
        ))}
        <span className="ml-3 text-[11px] truncate" style={{ color: c.muted }}>margitrack.app</span>
      </div>
      {children}
    </div>
  );
}

/**
 * Emplacement photo.
 *
 * Les photographies du restaurant ne sont pas livrées avec le code : tant
 * qu'un fichier n'a pas été déposé dans public/images/photos, l'image
 * n'existe pas et le navigateur afficherait une icône cassée. On dessine
 * alors une composition de remplacement, aux couleurs de Margitrack, qui
 * tient sa place sans jamais casser la page. Dès qu'une photo est déposée
 * sous le même nom, elle prend sa place sans toucher au code.
 */
export function Photo({ c, src, alt, label, icon, className = "", ratio = "4 / 3", rounded = "rounded-3xl" }) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`relative overflow-hidden ${rounded} ${className}`}
      style={{
        aspectRatio: ratio,
        backgroundColor: c.elevated,
        border: `1px solid ${c.line}`,
      }}
    >
      {!failed && src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
          style={{
            background: `radial-gradient(120% 90% at 20% 0%, ${c.softViolet}, transparent 60%), radial-gradient(100% 80% at 100% 100%, ${c.softGreen}, transparent 55%), ${c.elevated}`,
          }}
        >
          {/* Trame discrète : sans elle le remplacement ressemble à une zone
              vide plutôt qu'à un visuel voulu. */}
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage: `linear-gradient(${c.line} 1px, transparent 1px), linear-gradient(90deg, ${c.line} 1px, transparent 1px)`,
              backgroundSize: "32px 32px",
              maskImage: "radial-gradient(70% 70% at 50% 50%, #000, transparent)",
              WebkitMaskImage: "radial-gradient(70% 70% at 50% 50%, #000, transparent)",
            }}
            aria-hidden="true"
          />
          <span
            className="relative inline-flex items-center justify-center rounded-2xl"
            style={{ width: 64, height: 64, backgroundColor: c.card, border: `1px solid ${c.line}`, fontSize: 30 }}
            aria-hidden="true"
          >
            {icon}
          </span>
          <p className="relative text-xs font-medium max-w-[16rem]" style={{ color: c.muted }}>{label ?? alt}</p>
        </div>
      )}
    </div>
  );
}
