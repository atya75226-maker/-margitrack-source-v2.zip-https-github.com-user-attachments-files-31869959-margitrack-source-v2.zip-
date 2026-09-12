import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const REQUIRED = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];

export default defineConfig(({ mode }) => {
  // loadEnv lit les fichiers .env ET les variables du système (celles que
  // Vercel injecte au build). On vérifie ici plutôt qu'au chargement de la
  // page : une variable oubliée fait échouer le build avec un message clair,
  // au lieu de servir une application qui plante sur écran blanc.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const missing = REQUIRED.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Variables d'environnement manquantes : ${missing.join(", ")}.\n` +
        "En local : copiez .env.example vers .env et renseignez vos clés Supabase.\n" +
        "Sur Vercel : Settings → Environment Variables, puis relancez le déploiement."
    );
  }

  return {
    plugins: [react()],
    build: {
      outDir: "dist",
    },
  };
});
