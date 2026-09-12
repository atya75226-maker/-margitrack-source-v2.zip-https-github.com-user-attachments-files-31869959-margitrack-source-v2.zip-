import React, { useState } from "react";
import { COLOR } from "../../lib/theme";
import { useAuth } from "../../contexts/AuthContext";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";
import { SetPasswordForm, isAuthRedirectLink } from "./SetPasswordForm";

function FullscreenLoader({ label }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ backgroundColor: COLOR.paper }}>
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: COLOR.violet, borderTopColor: "transparent" }} />
      {label && <p className="text-sm" style={{ color: COLOR.ink }}>{label}</p>}
    </div>
  );
}

function AuthScreen({ initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: COLOR.paper }}>
      <div className="w-full max-w-sm rounded-3xl p-7 bg-[#111827]" style={{ border: `1px solid ${COLOR.line}`, boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}>
        <div className="flex items-center gap-2.5 mb-6">
          <img src="/logo.svg" alt="Margitrack" className="w-11 h-11 rounded-xl object-contain" />
          <p className="font-semibold text-lg" style={{ color: COLOR.ink }}>Margitrack</p>
        </div>
        {mode === "login" ? <LoginForm onSwitchToSignup={() => setMode("signup")} /> : <SignupForm onSwitchToLogin={() => setMode("login")} />}
      </div>
    </div>
  );
}

function OwnerSetupError({ message }) {
  const { retryOwnerSetup, signOut } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const retry = async () => { setRetrying(true); await retryOwnerSetup(); setRetrying(false); };
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: COLOR.paper }}>
      <div className="w-full max-w-sm rounded-3xl p-7 bg-[#111827] text-center" style={{ border: `1px solid ${COLOR.line}`, boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}>
        <p className="font-semibold mb-2" style={{ color: COLOR.ink }}>La création de votre espace a échoué</p>
        <p className="text-sm mb-6" style={{ color: "#5B6659" }}>{message}</p>
        <button onClick={retry} disabled={retrying} className="w-full rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-50 mb-3" style={{ backgroundColor: COLOR.violet }}>
          {retrying ? "Nouvel essai..." : "Réessayer"}
        </button>
        <button onClick={signOut} className="text-xs" style={{ color: "#5B6659" }}>Se déconnecter</button>
      </div>
    </div>
  );
}

export function RequireAuth({ children, initialMode = "login" }) {
  const { loading, isAuthenticated, profile, ownerSetupError } = useAuth();
  const [justFinishedInvite, setJustFinishedInvite] = useState(false);

  if (isAuthRedirectLink() && !justFinishedInvite) {
    return <SetPasswordForm onDone={() => setJustFinishedInvite(true)} />;
  }

  if (loading) return <FullscreenLoader />;
  if (!isAuthenticated) return <AuthScreen initialMode={initialMode} />;
  if (ownerSetupError && !profile) return <OwnerSetupError message={ownerSetupError} />;
  if (!profile) return <FullscreenLoader label="Préparation de votre espace..." />;

  return children;
}
