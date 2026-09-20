import { useCallback, useEffect, useState } from "react";

/**
 * Palettes de la page d'accueil publique.
 *
 * Le visiteur n'est pas connecté : il n'a pas de préférence enregistrée dans
 * l'application. Le thème suit donc celui de son téléphone, et un bouton
 * permet d'en changer. Les valeurs sont exactement celles de l'application
 * (PreferencesContext) pour que le site et le logiciel se ressemblent.
 */
const BRAND = {
  violet: "#7C5CFF",
  violetDeep: "#5B3FD9",
  green: "#10B981",
  amber: "#F59E08",
  rose: "#F43F5E",
};

export const DARK = {
  ...BRAND,
  name: "dark",
  bg: "#0B0D17",
  card: "#111827",
  elevated: "#1B1F2E",
  line: "#1B1F2E",
  ink: "#F5F5F7",
  muted: "#9CA3AF",
  // Fonds de section alternés, pour séparer les blocs sans traits partout.
  band: "#0E1120",
  glow: "rgba(124,92,255,0.22)",
  softViolet: "rgba(124,92,255,0.14)",
  softGreen: "rgba(16,185,129,0.14)",
  shadow: "0 24px 60px rgba(0,0,0,0.55)",
};

export const LIGHT = {
  ...BRAND,
  name: "light",
  bg: "#F6F7FB",
  card: "#FFFFFF",
  elevated: "#EEF0F6",
  line: "#E2E5EE",
  ink: "#14161F",
  muted: "#5B6070",
  band: "#FFFFFF",
  glow: "rgba(124,92,255,0.18)",
  softViolet: "rgba(124,92,255,0.10)",
  softGreen: "rgba(16,185,129,0.10)",
  shadow: "0 24px 60px rgba(20,22,31,0.12)",
};

const KEY = "margitrack:landing-theme";

function preferred() {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Stockage refusé : on se rabat sur la préférence du système.
  }
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function useLandingTheme() {
  const [name, setName] = useState(preferred);
  const colors = name === "light" ? LIGHT : DARK;

  const toggle = useCallback(() => {
    setName((current) => {
      const next = current === "light" ? "dark" : "light";
      try {
        window.localStorage.setItem(KEY, next);
      } catch {
        // Sans mémoire, le choix vaut pour la visite en cours : acceptable.
      }
      return next;
    });
  }, []);

  // L'application peint <html> et <body> aux couleurs du thème qu'un
  // utilisateur connecté a choisi, et le fait après cette page-ci : tirer la
  // page au-delà de son contenu découvrait alors un fond sombre sous une
  // vitrine claire. Une règle de feuille de style marquée « important » passe
  // devant ces styles en ligne, quel que soit l'ordre des effets.
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-margitrack", "landing-theme");
    style.textContent = `html, body { background-color: ${colors.bg} !important; }`;
    document.head.appendChild(style);
    return () => style.remove();
  }, [colors.bg]);

  return { name, colors, toggle };
}
