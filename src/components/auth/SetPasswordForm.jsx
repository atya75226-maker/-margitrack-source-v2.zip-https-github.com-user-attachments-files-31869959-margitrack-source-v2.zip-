import React, { useState } from "react";
import { COLOR } from "../../lib/theme";
import { supabase } from "../../lib/supabaseClient";

export function SetPasswordForm({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Le mot de passe doit contenir au moins 6 caractères."); return; }
    if (password !== confirm) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { setError(updateError.message); return; }
    setDone(true);
    window.history.replaceState({}, document.title, window.location.pathname);
    setTimeout(() => onDone?.(), 1200);
  };

  if (done) {
    return (<div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: COLOR.paper }}><p style={{ color: COLOR.ink }}>Mot de passe enregistré. Redirection...</p></div>);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: COLOR.paper }}>
      <div className="w-full max-w-sm rounded-3xl p-7 bg-[#111827]" style={{ border: `1px solid ${COLOR.line}`, boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}>
        <p className="font-semibold mb-1" style={{ color: COLOR.ink }}>Choisissez votre mot de passe</p>
        <p className="text-sm mb-6" style={{ color: COLOR.muted }}>Cette étape termine votre inscription à Margitrack.</p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium" style={{ color: COLOR.ink }}>Nouveau mot de passe</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border px-3.5 py-2.5 text-sm outline-none text-white placeholder-gray-500" style={{ borderColor: COLOR.line, backgroundColor: COLOR.card }} />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: COLOR.ink }}>Confirmer le mot de passe</label>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border px-3.5 py-2.5 text-sm outline-none text-white placeholder-gray-500" style={{ borderColor: COLOR.line, backgroundColor: COLOR.card }} />
          </div>
          {error && <p className="text-sm font-medium" style={{ color: COLOR.brick }}>{error}</p>}
          <button type="submit" disabled={loading} className="rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: COLOR.violet }}>
            {loading ? "Enregistrement..." : "Valider"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function isAuthRedirectLink() {
  const hash = window.location.hash?.replace(/^#/, "");
  const hashParams = new URLSearchParams(hash);
  const queryParams = new URLSearchParams(window.location.search);
  const type = hashParams.get("type") || queryParams.get("type");
  return type === "invite" || type === "recovery";
}
