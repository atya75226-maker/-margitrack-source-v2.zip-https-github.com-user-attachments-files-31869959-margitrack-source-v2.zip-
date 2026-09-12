import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { usePreferences } from "../contexts/PreferencesContext";
import { supabase } from "../lib/supabaseClient";

export function ProfileScreen({ onBack }) {
  const { profile, user, restaurant, role, signOut } = useAuth();
  const { palette, t } = usePreferences();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  const save = async () => {
    setError(null); setMessage(null); setSaving(true);
    const { error: err } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null, phone: phone.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (err) setError(err.message);
    else setMessage(t("profile_updated"));
  };

  // Suppression de compte : on supprime les données du restaurant dont
  // l'utilisateur est propriétaire (les tables liées suivent en cascade),
  // puis on déconnecte. La suppression du compte d'authentification
  // lui-même se fait côté Supabase et nécessite une intervention de
  // notre part — on l'indique clairement plutôt que de le laisser croire
  // que tout a disparu instantanément.
  const deleteAccount = async () => {
    setError(null); setSaving(true);
    try {
      if (role === "proprietaire" && restaurant?.id) {
        const { error: delErr } = await supabase.from("restaurants").delete().eq("id", restaurant.id);
        if (delErr) throw delErr;
      } else {
        const { error: delErr } = await supabase.from("profiles").delete().eq("id", user.id);
        if (delErr) throw delErr;
      }
      await signOut();
    } catch (err) {
      setError(err.message || "Suppression impossible.");
      setSaving(false);
    }
  };

  const input = {
    backgroundColor: palette.elevated,
    borderColor: palette.line,
    color: palette.ink,
  };

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: palette.bg }}>
      <header className="sticky top-0 z-10 px-4 py-3 border-b" style={{ backgroundColor: palette.card, borderColor: palette.line }}>
        <button onClick={onBack} className="text-sm font-medium" style={{ color: "#7C5CFF" }}>← {t("back_to_settings")}</button>
      </header>

      <main className="p-4 space-y-4">
        <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: palette.card, border: `1px solid ${palette.line}` }}>
          <p className="text-sm font-semibold" style={{ color: palette.ink }}>{t("my_profile")}</p>

          <div>
            <label className="text-xs" style={{ color: palette.muted }}>{t("full_name")}</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={input} placeholder={t("full_name")} />
          </div>

          <div>
            <label className="text-xs" style={{ color: palette.muted }}>{t("phone")}</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={input} placeholder={t("phone")} />
          </div>

          <div>
            <label className="text-xs" style={{ color: palette.muted }}>{t("email_readonly")}</label>
            <p className="mt-1 text-sm" style={{ color: palette.muted }}>{user?.email}</p>
          </div>

          <div>
            <label className="text-xs" style={{ color: palette.muted }}>{t("role")}</label>
            <p className="mt-1 text-sm capitalize" style={{ color: palette.ink }}>{role}</p>
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}
          {message && <p className="text-xs text-emerald-500">{message}</p>}

          <button onClick={save} disabled={saving}
            className="w-full rounded-xl text-white text-sm font-medium py-2.5 disabled:opacity-50"
            style={{ backgroundColor: "#7C5CFF" }}>
            {saving ? t("saving") : t("save_my_info")}
          </button>
        </div>

        <div className="rounded-2xl p-4" style={{ backgroundColor: palette.card, border: `1px solid ${palette.line}` }}>
          <p className="text-sm font-semibold mb-3" style={{ color: palette.ink }}>{t("session")}</p>
          <button onClick={signOut} className="text-sm font-medium text-rose-500">{t("sign_out")}</button>
        </div>

        <div className="rounded-2xl p-4" style={{ backgroundColor: palette.card, border: "1px solid rgba(244,63,94,0.35)" }}>
          <p className="text-sm font-semibold mb-1 text-rose-500">{t("delete_account")}</p>
          <p className="text-xs mb-3" style={{ color: palette.muted }}>
            {role === "proprietaire"
              ? t("delete_warning_owner")
              : t("delete_warning_staff")}
          </p>

          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="text-sm font-medium text-rose-500">
              {t("delete_ask")}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs" style={{ color: palette.muted }}>
                {t("delete_confirm_hint")} <strong>SUPPRIMER</strong>.
              </p>
              <input value={deleteText} onChange={(e) => setDeleteText(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm" style={input} placeholder="SUPPRIMER" />
              <div className="flex gap-2">
                <button onClick={deleteAccount} disabled={deleteText !== "SUPPRIMER" || saving}
                  className="flex-1 rounded-xl bg-rose-600 text-white text-sm font-semibold py-2.5 disabled:opacity-40">
                  {t("delete_forever")}
                </button>
                <button onClick={() => { setConfirmDelete(false); setDeleteText(""); }}
                  className="flex-1 rounded-xl border text-sm font-medium py-2.5"
                  style={{ borderColor: palette.line, color: palette.ink }}>
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
