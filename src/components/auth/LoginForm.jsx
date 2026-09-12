import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { COLOR } from "../../lib/theme";
import { supabase } from "../../lib/supabaseClient";

function friendlyAuthError(err) {
  const msg = err?.message?.toLowerCase() || "";
  if (msg.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (msg.includes("email not confirmed")) return "Confirmez votre email avant de vous connecter (lien envoyé à l'inscription).";
  if (msg.includes("failed to fetch") || msg.includes("network")) return "Connexion impossible. Vérifiez votre connexion internet.";
  return err?.message || "Connexion impossible.";
}

export function LoginForm({ onSwitchToSignup }) {
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setInfo("");
    setLoading(true);
    try { await signIn({ email, password }); } catch (err) { setError(friendlyAuthError(err)); } finally { setLoading(false); }
  };

  const withGoogle = async () => {
    setError(""); setInfo("");
    setGoogleLoading(true);
    try { await signInWithGoogle(); } catch (err) { setError(friendlyAuthError(err)); setGoogleLoading(false); }
  };

  const forgotPassword = async () => {
    setError(""); setInfo("");
    if (!email) { setError("Indiquez votre email ci-dessus, puis cliquez de nouveau sur ce lien."); return; }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setLoading(false);
    if (resetError) setError(friendlyAuthError(resetError));
    else setInfo("Un email vous a été envoyé pour choisir un nouveau mot de passe.");
  };

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
        <div>
          <label className="text-sm font-medium" style={{ color: COLOR.ink }}>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-2xl border px-3.5 py-2.5 text-sm outline-none text-white placeholder-gray-500" style={{ borderColor: COLOR.line, backgroundColor: COLOR.card }} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" style={{ color: COLOR.ink }}>Mot de passe</label>
            <button type="button" onClick={forgotPassword} className="text-xs font-medium" style={{ color: COLOR.violet }}>Mot de passe oublié ?</button>
          </div>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-2xl border px-3.5 py-2.5 text-sm outline-none text-white placeholder-gray-500" style={{ borderColor: COLOR.line, backgroundColor: COLOR.card }} />
        </div>
        {error && <p className="text-sm font-medium" style={{ color: COLOR.brick }}>{error}</p>}
        {info && <p className="text-sm font-medium" style={{ color: COLOR.emerald }}>{info}</p>}
        <button type="submit" disabled={loading} className="rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: COLOR.violet }}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>
        <button type="button" onClick={onSwitchToSignup} className="text-sm font-medium" style={{ color: COLOR.violet }}>
          Pas encore de compte ? Créer mon restaurant
        </button>
      </form>
    </div>
  );
}
