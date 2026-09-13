import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext";
import { PreferencesProvider } from "./contexts/PreferencesContext";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa";

// PreferencesProvider est à l'intérieur d'AuthProvider : il lit le profil
// et le restaurant pour restaurer le thème, la langue et la devise choisis.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <PreferencesProvider>
        <App />
      </PreferencesProvider>
    </AuthProvider>
  </React.StrictMode>
);

// Rend l'application installable et utilisable hors ligne.
registerServiceWorker();
