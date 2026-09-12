import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthContext";
import { translate } from "../lib/translations";

// Devises proposées. Le propriétaire choisit celle dans laquelle il vend :
// il peut être au Togo et vendre en dollars, ou changer plus tard.
export const CURRENCIES = [
  { code: "FCFA", label: "Franc CFA (FCFA)", symbol: "FCFA", after: true },
  { code: "EUR", label: "Euro (€)", symbol: "€", after: true },
  { code: "USD", label: "Dollar américain ($)", symbol: "$", after: false },
  { code: "GHS", label: "Cedi ghanéen (₵)", symbol: "₵", after: false },
  { code: "NGN", label: "Naira nigérian (₦)", symbol: "₦", after: false },
  { code: "MAD", label: "Dirham marocain (MAD)", symbol: "MAD", after: true },
  { code: "GBP", label: "Livre sterling (£)", symbol: "£", after: false },
  { code: "CAD", label: "Dollar canadien (CA$)", symbol: "CA$", after: false },
];

export const LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
];

const PreferencesContext = createContext(null);

export function PreferencesProvider({ children }) {
  const { profile, restaurant, restaurantId, user } = useAuth();

  const [theme, setThemeState] = useState("dark");
  const [language, setLanguageState] = useState("fr");
  const [currency, setCurrencyState] = useState("FCFA");

  // On lit les préférences déjà enregistrées en base dès qu'elles arrivent,
  // pour que le choix soit mémorisé d'une session à l'autre.
  useEffect(() => {
    if (profile?.theme) setThemeState(profile.theme);
    if (profile?.language) setLanguageState(profile.language);
  }, [profile?.theme, profile?.language]);

  useEffect(() => {
    if (restaurant?.currency) setCurrencyState(restaurant.currency);
  }, [restaurant?.currency]);

  const setTheme = useCallback(async (next) => {
    setThemeState(next);
    if (user?.id) await supabase.from("profiles").update({ theme: next }).eq("id", user.id);
  }, [user?.id]);

  const setLanguage = useCallback(async (next) => {
    setLanguageState(next);
    if (user?.id) await supabase.from("profiles").update({ language: next }).eq("id", user.id);
  }, [user?.id]);

  const setCurrency = useCallback(async (next) => {
    setCurrencyState(next);
    if (restaurantId) await supabase.from("restaurants").update({ currency: next }).eq("id", restaurantId);
  }, [restaurantId]);

  // Formatage monétaire unique pour toute l'application : si le restaurant
  // choisit une autre devise, tous les montants suivent automatiquement.
  const formatMoney = useCallback((n) => {
    const cur = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];
    const amount = new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
    return cur.after ? `${amount} ${cur.symbol}` : `${cur.symbol}${amount}`;
  }, [currency]);

  const isLight = theme === "light";

  // Palette dérivée : en mode clair les fonds s'éclaircissent et les textes
  // s'assombrissent, mais l'identité Margitrack (violet, vert) est conservée.
  const palette = isLight
    ? {
        bg: "#F6F7FB", card: "#FFFFFF", elevated: "#EEF0F6", line: "#E2E5EE",
        ink: "#14161F", muted: "#5B6070", paper: "#F6F7FB",
      }
    : {
        bg: "#0B0D17", card: "#111827", elevated: "#1B1F2E", line: "#1B1F2E",
        ink: "#F5F5F7", muted: "#9CA3AF", paper: "#0B0D17",
      };

  useEffect(() => {
    document.documentElement.style.backgroundColor = palette.bg;
    document.body.style.backgroundColor = palette.bg;
    document.body.style.color = palette.ink;
  }, [palette.bg, palette.ink]);

  // t("clé") renvoie le texte dans la langue choisie (français par défaut).
  const t = useCallback((key) => translate(language, key), [language]);

  const value = {
    theme, setTheme, isLight, palette,
    language, setLanguage, t,
    currency, setCurrency, formatMoney,
  };

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences() doit être utilisé à l'intérieur de <PreferencesProvider>");
  return ctx;
}
