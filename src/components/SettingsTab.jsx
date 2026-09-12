import React, { useMemo, useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { usePreferences, CURRENCIES, LANGUAGES } from "../contexts/PreferencesContext";
import { supabase } from "../lib/supabaseClient";

// Suggestions de métiers courants — le propriétaire n'est jamais limité à
// cette liste : le champ est libre, il peut taper n'importe quel intitulé.
const ROLE_SUGGESTIONS = [
  "Gérant", "Secrétaire", "Caissier", "Serveur", "Cuisinier", "Aide-cuisinier",
  "Responsable stock", "Livreur", "Plongeur", "Nettoyeur", "Gardien", "Responsable achats",
];

const emptyForm = { name: "", role: "", phone: "", monthlySalary: "", hireDate: "" };

export function SettingsTab({ members, onAddMember, onUpdateMember, onRemoveMember, restaurant, onOpenSubscription, onOpenProfile, onOpenAccess }) {
  const { profile, role: myRole, restaurantId } = useAuth();
  const { palette, theme, setTheme, currency, setCurrency, language, setLanguage, formatMoney, t } = usePreferences();

  const isOwner = myRole === "proprietaire";

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);

  // Infos du restaurant, modifiables par le propriétaire
  const [resto, setResto] = useState({ name: "", phone: "", address: "" });
  const [restoSaving, setRestoSaving] = useState(false);
  const [restoMsg, setRestoMsg] = useState(null);

  useEffect(() => {
    setResto({
      name: restaurant?.name ?? "",
      phone: restaurant?.phone ?? "",
      address: restaurant?.address ?? "",
    });
  }, [restaurant?.name, restaurant?.phone, restaurant?.address]);

  const saveResto = async () => {
    setRestoMsg(null); setRestoSaving(true);
    const { error: err } = await supabase
      .from("restaurants")
      .update({
        name: resto.name.trim(),
        phone: resto.phone.trim() || null,
        address: resto.address.trim() || null,
      })
      .eq("id", restaurantId);
    setRestoSaving(false);
    setRestoMsg(err ? (err.message || "Modification impossible.") : "Informations enregistrées.");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.role.trim()) { setError(t("name_job_required")); return; }
    setSaving(true);
    try {
      await onAddMember({
        name: form.name.trim(),
        role: form.role.trim(),
        phone: form.phone.trim(),
        monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : null,
        hireDate: form.hireDate || null,
      });
      setForm(emptyForm);
    } catch (err) {
      setError(err.message || "Impossible d'ajouter cet employé.");
    } finally { setSaving(false); }
  };

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditForm({
      name: m.full_name,
      role: m.role,
      phone: m.phone || "",
      monthlySalary: m.monthly_salary != null ? String(m.monthly_salary) : "",
      hireDate: m.hire_date || "",
    });
  };

  const saveEdit = async (id) => {
    try {
      await onUpdateMember(id, {
        name: editForm.name.trim(),
        role: editForm.role.trim(),
        phone: editForm.phone.trim(),
        monthlySalary: editForm.monthlySalary ? Number(editForm.monthlySalary) : null,
        hireDate: editForm.hireDate || null,
      });
      setEditingId(null);
    } catch (err) {
      setError(err.message || "Impossible de modifier cet employé.");
    }
  };

  const toggleActive = async (m) => {
    try { await onUpdateMember(m.id, { isActive: !m.is_active }); }
    catch (err) { setError(err.message || "Impossible de mettre à jour le statut."); }
  };

  const masseSalariale = useMemo(
    () => members.filter((m) => m.is_active).reduce((sum, m) => sum + Number(m.monthly_salary || 0), 0),
    [members]
  );

  const card = { backgroundColor: palette.card, border: `1px solid ${palette.line}` };
  const input = { backgroundColor: palette.elevated, borderColor: palette.line, color: palette.ink };

  return (
    <div className="space-y-4">
      {/* PROFIL */}
      <button onClick={onOpenProfile} className="w-full rounded-2xl p-4 flex items-center justify-between" style={card}>
        <div className="text-left">
          <p className="text-sm font-semibold" style={{ color: palette.ink }}>{t("my_profile")}</p>
          <p className="text-xs" style={{ color: palette.muted }}>{profile?.full_name || "—"} · {t("my_profile")}</p>
        </div>
        <span style={{ color: "#7C5CFF" }}>›</span>
      </button>

      {/* ACCES A MARGITRACK (proprietaire uniquement) */}
      {isOwner && (
        <button onClick={onOpenAccess} className="w-full rounded-2xl p-4 flex items-center justify-between" style={card}>
          <div className="text-left">
            <p className="text-sm font-semibold" style={{ color: palette.ink }}>Accès à Margitrack</p>
            <p className="text-xs" style={{ color: palette.muted }}>
              Comptes, rôles et permissions de votre équipe
            </p>
          </div>
          <span style={{ color: "#7C5CFF" }}>›</span>
        </button>
      )}

      {/* INFOS RESTAURANT */}
      <div className="rounded-2xl p-4 space-y-3" style={card}>
        <p className="text-sm font-semibold" style={{ color: palette.ink }}>{t("restaurant_info")}</p>
        {isOwner ? (
          <>
            <div>
              <label className="text-xs" style={{ color: palette.muted }}>{t("restaurant_name")}</label>
              <input value={resto.name} onChange={(e) => setResto((r) => ({ ...r, name: e.target.value }))}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={input} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs" style={{ color: palette.muted }}>{t("phone")}</label>
                <input value={resto.phone} onChange={(e) => setResto((r) => ({ ...r, phone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={input} />
              </div>
              <div>
                <label className="text-xs" style={{ color: palette.muted }}>{t("address")}</label>
                <input value={resto.address} onChange={(e) => setResto((r) => ({ ...r, address: e.target.value }))}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={input} />
              </div>
            </div>
            {restoMsg && <p className="text-xs" style={{ color: palette.muted }}>{restoMsg}</p>}
            <button onClick={saveResto} disabled={restoSaving || !resto.name.trim()}
              className="w-full rounded-xl text-white text-sm font-medium py-2.5 disabled:opacity-50"
              style={{ backgroundColor: "#7C5CFF" }}>
              {restoSaving ? t("saving") : t("save")}
            </button>
          </>
        ) : (
          <p className="text-sm" style={{ color: palette.ink }}>{restaurant?.name}</p>
        )}
        <button onClick={onOpenSubscription} className="text-sm font-medium" style={{ color: "#7C5CFF" }}>{t("manage_subscription")} →</button>
      </div>

      {/* APPARENCE */}
      <div className="rounded-2xl p-4 space-y-3" style={card}>
        <p className="text-sm font-semibold" style={{ color: palette.ink }}>{t("appearance")}</p>
        <div className="grid grid-cols-2 gap-2">
          {[{ id: "dark", label: `🌙 ${t("dark_theme")}` }, { id: "light", label: `☀️ ${t("light_theme")}` }].map((t) => (
            <button key={t.id} onClick={() => setTheme(t.id)}
              className="rounded-xl text-sm font-medium py-2.5 border"
              style={theme === t.id
                ? { backgroundColor: "#7C5CFF", color: "#FFFFFF", borderColor: "#7C5CFF" }
                : { backgroundColor: palette.elevated, color: palette.ink, borderColor: palette.line }}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs" style={{ color: palette.muted }}>{t("theme_saved")}</p>
      </div>

      {/* DEVISE */}
      <div className="rounded-2xl p-4 space-y-3" style={card}>
        <p className="text-sm font-semibold" style={{ color: palette.ink }}>{t("currency")}</p>
        <p className="text-xs" style={{ color: palette.muted }}>
          {t("currency_help")}
        </p>
        {isOwner ? (
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm" style={input}>
            {CURRENCIES.map((c) => (<option key={c.code} value={c.code}>{c.label}</option>))}
          </select>
        ) : (
          <p className="text-sm" style={{ color: palette.ink }}>{currency}</p>
        )}
        <p className="text-xs" style={{ color: palette.muted }}>{t("preview")} : {formatMoney(125000)}</p>
      </div>

      {/* LANGUE */}
      <div className="rounded-2xl p-4 space-y-3" style={card}>
        <p className="text-sm font-semibold" style={{ color: palette.ink }}>{t("language")}</p>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 text-sm" style={input}>
          {LANGUAGES.map((l) => (<option key={l.code} value={l.code}>{l.label}</option>))}
        </select>
        <p className="text-xs" style={{ color: palette.muted }}>
          Votre préférence est enregistrée. La traduction complète de l'interface arrive prochainement.
        </p>
      </div>

      {/* MASSE SALARIALE */}
      {members.some((m) => m.monthly_salary != null) && (
        <div className="rounded-2xl p-4 flex items-center justify-between" style={card}>
          <p className="text-sm font-semibold" style={{ color: palette.ink }}>{t("payroll")}</p>
          <p className="text-sm font-bold" style={{ color: palette.ink }}>{formatMoney(masseSalariale)}</p>
        </div>
      )}

      {/* AJOUT EMPLOYÉ */}
      <form onSubmit={submit} className="rounded-2xl p-4 space-y-3" style={card}>
        <p className="text-sm font-semibold" style={{ color: palette.ink }}>{t("add_employee")}</p>
        <p className="text-xs -mt-1" style={{ color: palette.muted }}>
          {t("employee_note")}
        </p>
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Nom (ex : Koffi)" className="w-full rounded-xl border px-3 py-2 text-sm" style={input} />
        <input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          list="role-suggestions" placeholder={t("job_placeholder")}
          className="w-full rounded-xl border px-3 py-2 text-sm" style={input} />
        <datalist id="role-suggestions">
          {ROLE_SUGGESTIONS.map((r) => <option key={r} value={r} />)}
        </datalist>
        <div className="grid grid-cols-2 gap-2">
          <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder={t("phone")} className="w-full rounded-xl border px-3 py-2 text-sm" style={input} />
          <input value={form.monthlySalary} onChange={(e) => setForm((f) => ({ ...f, monthlySalary: e.target.value }))}
            type="text" inputMode="decimal" placeholder={t("monthly_salary")}
            className="w-full rounded-xl border px-3 py-2 text-sm" style={input} />
        </div>
        <div>
          <label className="text-xs" style={{ color: palette.muted }}>{t("hire_date")}</label>
          <input value={form.hireDate} onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))}
            type="date" className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={input} />
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <button type="submit" disabled={saving}
          className="w-full rounded-xl text-white text-sm font-medium py-2.5 disabled:opacity-50"
          style={{ backgroundColor: "#7C5CFF" }}>{saving ? t("adding") : t("add")}</button>
      </form>

      {/* LISTE ÉQUIPE */}
      <div className="space-y-2">
        <p className="text-sm font-semibold" style={{ color: palette.ink }}>{t("team")}</p>
        {members.map((m) => (
          <div key={m.id} className="rounded-xl p-3" style={card}>
            {editingId === m.id ? (
              <div className="space-y-2">
                <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border px-2.5 py-1.5 text-sm" style={input} placeholder="Nom" />
                <input value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                  list="role-suggestions" className="w-full rounded-lg border px-2.5 py-1.5 text-sm" style={input} placeholder={t("job_placeholder")} />
                <div className="grid grid-cols-2 gap-2">
                  <input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-lg border px-2.5 py-1.5 text-sm" style={input} placeholder={t("phone")} />
                  <input value={editForm.monthlySalary} onChange={(e) => setEditForm((f) => ({ ...f, monthlySalary: e.target.value }))}
                    type="text" inputMode="decimal" className="w-full rounded-lg border px-2.5 py-1.5 text-sm" style={input} placeholder={t("monthly_salary")} />
                </div>
                <input value={editForm.hireDate} onChange={(e) => setEditForm((f) => ({ ...f, hireDate: e.target.value }))}
                  type="date" className="w-full rounded-lg border px-2.5 py-1.5 text-sm" style={input} />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(m.id)} className="flex-1 rounded-lg text-white text-xs font-semibold py-2" style={{ backgroundColor: "#7C5CFF" }}>{t("save")}</button>
                  <button onClick={() => setEditingId(null)} className="flex-1 rounded-lg border text-xs font-medium py-2" style={{ borderColor: palette.line, color: palette.ink }}>{t("cancel")}</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: m.is_active ? palette.ink : palette.muted, textDecoration: m.is_active ? "none" : "line-through" }}>
                    {m.full_name} — {m.role}
                  </p>
                  <p className="text-xs truncate" style={{ color: palette.muted }}>
                    {m.phone || t("no_phone")}
                    {m.monthly_salary != null ? ` · ${formatMoney(m.monthly_salary)}` : ""}
                    {m.hire_date ? ` · ${t("since")} ${new Date(m.hire_date).toLocaleDateString(language === "en" ? "en-GB" : "fr-FR")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleActive(m)} className={`text-xs font-medium px-2 py-1 rounded-lg ${m.is_active ? "text-amber-500" : "text-emerald-500"}`}>
                    {m.is_active ? t("deactivate") : t("reactivate")}
                  </button>
                  <button onClick={() => startEdit(m)} className="text-xs font-medium" style={{ color: "#7C5CFF" }}>{t("edit")}</button>
                  <button onClick={() => onRemoveMember(m)} className="text-xs text-rose-500">{t("remove")}</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {members.length === 0 && <p className="text-xs text-center py-4" style={{ color: palette.muted }}>{t("no_employees")}</p>}
      </div>
    </div>
  );
}
