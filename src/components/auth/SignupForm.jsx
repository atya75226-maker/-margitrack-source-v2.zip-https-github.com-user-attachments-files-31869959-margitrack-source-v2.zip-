import React, { useState } from "react";
import { COLOR } from "../../lib/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useLegal } from "../../contexts/LegalContext";

function friendlyAuthError(err) {
  const msg = err?.message?.toLowerCase() || "";
  if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already"))
    return "Un compte existe déjà avec cet email — connectez-vous plutôt.";
  if (msg.includes("password") && msg.includes("least")) return "Le mot de passe doit contenir au moins 6 caractères.";
  if (msg.includes("failed to fetch") || msg.includes("network")) return "Connexion impossible. Vérifiez votre connexion internet.";
  return err?.message || "Inscription impossible.";
}

export function SignupForm({ onSwitchToLogin }) {
  const { openPrivacy, openTerms } = useLegal();
  const { signUpOwner, signInWithGoogle } = useAuth();
  const [form, setForm] = useState({ restaurantName: "", fullName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) { setError("Le mot de passe doit contenir au moins 6 caractères."); return; }
    setLoading(true);
    try {
      const result = await signUpOwner(form);
      if (result.requiresEmailConfirmation) setAwaitingConfirmation(true);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally { setLoading(false); }
  };

  const withGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try { await signInWithGoogle(); } catch (err) { setError(friendlyAuthError(err)); setGoogleLoading(false); }
  };

  if (awaitingConfirmation) {
    return (
      <div className="flex flex-col gap-4 text-center py-4">
        <p className="font-semibold" style={{ color: COLOR.ink }}>Vérifiez votre boîte mail</p>
        <p className="text-sm" style={{ color: COLOR.muted }}>
          Un email de confirmation a été envoyé à <strong>{form.email}</strong>. Cliquez sur le lien qu'il contient pour activer votre compte — vous arriverez directement sur votre tableau de bord.
        </p>
        <button type="button" onClick={onSwitchToLogin} className="text-sm font-medium" style={{ color: COLOR.violet }}>Retour à la connexion</button>
      </div>
    );
  }

  const field = (key, label, type = "text") => (
    <div>
      <label className="text-sm font-medium" style={{ color: COLOR.ink }}>{label}</label>
      <input type={type} required value={form[key]} onChange={update(key)}
        className="mt-1.5 w-full rounded-2xl border px-3.5 py-2.5 text-sm outline-none text-white placeholder-gray-500" style={{ borderColor: COLOR.line, backgroundColor: COLOR.card }} />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={withGoogle} disabled={googleLoading || loading}
        className="flex items-center justify-center gap-2.5 rounded-full py-2.5 text-sm font-semibold border disabled:opacity-50"
        style={{ borderColor: COLOR.line, color: COLOR.ink }}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"/>
          <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z"/>
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"/>
        </svg>
        {googleLoading ? "Redirection..." : "Continuer avec Google"}
      </button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1" style={{ backgroundColor: COLOR.line }} />
        <span className="text-xs" style={{ color: COLOR.muted }}>ou</span>
        <div className="h-px flex-1" style={{ backgroundColor: COLOR.line }} />
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {field("restaurantName", "Nom du restaurant")}
        {field("fullName", "Votre nom")}
        {field("email", "Email", "email")}
        {field("password", "Mot de passe (6 caractères min.)", "password")}
        {error && <p className="text-sm font-medium" style={{ color: COLOR.brick }}>{error}</p>}
        <button type="submit" disabled={loading} className="rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: COLOR.violet }}>
          {loading ? "Création..." : "Créer mon restaurant"}
        </button>
        <button type="button" onClick={onSwitchToLogin} className="text-sm font-medium" style={{ color: COLOR.violet }}>Déjà un compte ? Se connecter</button>
        <p className="text-xs" style={{ color: COLOR.muted }}>
          Ce compte sera le compte <strong>Propriétaire</strong>, avec accès complet. Vous pourrez inviter votre équipe une fois connecté.
        </p>
        <p className="text-xs" style={{ color: COLOR.muted }}>
          En créant un compte, vous acceptez nos{" "}
          <button type="button" onClick={openTerms} className="underline" style={{ color: COLOR.violet }}>Conditions d'utilisation</button>
          {" "}et notre{" "}
          <button type="button" onClick={openPrivacy} className="underline" style={{ color: COLOR.violet }}>Politique de confidentialité</button>.
        </p>
      </form>
    </div>
  );
}
