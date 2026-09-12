import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "https://hqpwlsbrhyrhlchtdzqm.supabase.co";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxcHdsc2JyaHlyaGxjaHRkenFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwNDI3MDQsImV4cCI6MjEwMTYxODcwNH0.QGQVnMK0uk1SjWjVn6fvDi9_qNzObiGP-67wbtyAgFk";

if (!url || !anonKey) {
  throw new Error(
    "VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définies (fichier .env à la racine du projet)."
  );
}

export const SUPABASE_URL = url;

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Appelle une Edge Function Supabase et lit la réponse en toute sécurité.
 * Vérifie le type de contenu avant de parser en JSON, et renvoie toujours
 * un message d'erreur exploitable plutôt qu'un plantage silencieux.
 */
export async function callEdgeFunction(name, { method = "POST", body, token } = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      `Réponse inattendue du serveur (${res.status}) — ce n'est pas la fonction Margitrack qui a répondu. Vérifiez la configuration.` +
        (text ? ` Détail : ${text.slice(0, 120)}` : "")
    );
  }

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Erreur serveur (${res.status})`);
  return json;
}
