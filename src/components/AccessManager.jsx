import React, { useCallback, useEffect, useState } from "react";
import { supabase, callEdgeFunction } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { usePreferences } from "../contexts/PreferencesContext";
import {
  ACCESS_ROLES,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  defaultPermissionsFor,
} from "../hooks/usePermissions";

const emptyGrant = {
  email: "",
  fullName: "",
  role: "gerant",
  phone: "",
  teamMemberId: "",
  permissions: [],
  useCustomPermissions: false,
};

export function AccessManager({ onBack, members = [] }) {
  const { restaurantId, user } = useAuth();
  const { palette } = usePreferences();

  const [accounts, setAccounts] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const [grant, setGrant] = useState(emptyGrant);
  const [showGrant, setShowGrant] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editPerms, setEditPerms] = useState([]);

  const [newRole, setNewRole] = useState({ label: "", permissions: [] });
  const [showRoleForm, setShowRoleForm] = useState(false);

  const card = { backgroundColor: palette.card, border: `1px solid ${palette.line}` };
  const input = { backgroundColor: palette.elevated, borderColor: palette.line, color: palette.ink };

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("restaurant_id", restaurantId).order("created_at"),
      supabase.from("custom_roles").select("*").eq("restaurant_id", restaurantId).order("label"),
    ]);
    setAccounts(profiles ?? []);
    setCustomRoles(roles ?? []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const allRoles = [
    ...ACCESS_ROLES,
    ...customRoles.map((r) => ({ code: r.code, label: `${r.label} (personnalisé)` })),
  ];

  const togglePerm = (list, key) =>
    list.includes(key) ? list.filter((p) => p !== key) : [...list, key];

  // Employés sans compte : ce sont eux qu'on peut inviter.
  const membersWithoutAccess = members.filter((m) => !m.profile_id);

  const submitGrant = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!grant.email.trim() || !grant.email.includes("@")) {
      setError("Une adresse email valide est requise.");
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await callEdgeFunction("invite-staff", {
        token: session?.access_token,
        body: {
          email: grant.email.trim(),
          full_name: grant.fullName.trim() || null,
          role: grant.role,
          phone: grant.phone.trim() || null,
          permissions: grant.useCustomPermissions ? grant.permissions : null,
          team_member_id: grant.teamMemberId || null,
        },
      });
      setMessage(`Invitation envoyée à ${grant.email.trim()}.`);
      setGrant(emptyGrant);
      setShowGrant(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const savePermissions = async (id) => {
    setError(null);
    const { error: err } = await supabase
      .from("profiles")
      .update({ permissions: editPerms.length > 0 ? editPerms : null })
      .eq("id", id);
    if (err) setError(err.message);
    else {
      setEditingId(null);
      await load();
    }
  };

  const toggleActive = async (account) => {
    setError(null);
    const { error: err } = await supabase
      .from("profiles")
      .update({ is_active: !account.is_active })
      .eq("id", account.id);
    if (err) setError(err.message);
    else await load();
  };

  const createCustomRole = async (e) => {
    e.preventDefault();
    setError(null);
    const label = newRole.label.trim();
    if (!label) {
      setError("Le nom du rôle est requis.");
      return;
    }
    const code = label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    const { error: err } = await supabase.from("custom_roles").insert({
      restaurant_id: restaurantId,
      code,
      label,
      permissions: newRole.permissions,
    });
    if (err) setError(err.message);
    else {
      setNewRole({ label: "", permissions: [] });
      setShowRoleForm(false);
      await load();
    }
  };

  const PermissionPicker = ({ selected, onToggle }) => (
    <div className="grid grid-cols-2 gap-1.5">
      {PERMISSION_KEYS.map((key) => {
        const on = selected.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            className="rounded-lg text-xs font-medium py-2 px-2 border text-left transition"
            style={
              on
                ? { backgroundColor: "rgba(124,92,255,0.15)", color: "#A78BFA", borderColor: "#7C5CFF" }
                : { backgroundColor: palette.elevated, color: palette.muted, borderColor: palette.line }
            }
          >
            {on ? "✓ " : ""}
            {PERMISSION_LABELS[key]}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: palette.bg }}>
      <header
        className="sticky top-0 z-10 px-4 py-3 border-b"
        style={{ backgroundColor: palette.card, borderColor: palette.line }}
      >
        <button onClick={onBack} className="text-sm font-medium" style={{ color: "#7C5CFF" }}>
          ← Retour aux réglages
        </button>
      </header>

      <main className="p-4 space-y-4">
        <div className="rounded-2xl p-4" style={card}>
          <p className="text-sm font-semibold" style={{ color: palette.ink }}>
            Accès à Margitrack
          </p>
          <p className="text-xs mt-1" style={{ color: palette.muted }}>
            Un employé enregistré dans votre équipe n'a pas de compte tant que vous ne lui
            donnez pas explicitement accès ici.
          </p>
        </div>

        {error && <p className="text-xs text-rose-500">{error}</p>}
        {message && <p className="text-xs text-emerald-500">{message}</p>}

        {/* Comptes existants */}
        <div className="space-y-2">
          <p className="text-sm font-semibold" style={{ color: palette.ink }}>
            Comptes ({accounts.length})
          </p>

          {loading && (
            <p className="text-xs" style={{ color: palette.muted }}>Chargement...</p>
          )}

          {accounts.map((a) => {
            const isOwner = a.role === "proprietaire";
            const isMe = a.id === user?.id;
            const effective =
              Array.isArray(a.permissions) && a.permissions.length > 0
                ? a.permissions
                : customRoles.find((r) => r.code === a.role)?.permissions ??
                  defaultPermissionsFor(a.role);

            return (
              <div key={a.id} className="rounded-xl p-3" style={card}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: palette.ink }}>
                      {a.full_name || "Sans nom"} {isMe && <span style={{ color: palette.muted }}>(vous)</span>}
                    </p>
                    <p className="text-xs capitalize" style={{ color: palette.muted }}>
                      {String(a.role).replace(/_/g, " ")}
                      {a.is_active === false && " · accès désactivé"}
                    </p>
                  </div>
                  {!isOwner && (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditingId(editingId === a.id ? null : a.id);
                          setEditPerms(effective);
                        }}
                        className="text-xs font-medium"
                        style={{ color: "#7C5CFF" }}
                      >
                        Permissions
                      </button>
                      <button
                        onClick={() => toggleActive(a)}
                        className={`text-xs font-medium ${a.is_active ? "text-amber-500" : "text-emerald-500"}`}
                      >
                        {a.is_active ? "Retirer l'accès" : "Rétablir l'accès"}
                      </button>
                    </div>
                  )}
                </div>

                {!isOwner && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {effective.length === 0 ? (
                      <span className="text-[11px]" style={{ color: palette.muted }}>
                        Aucune permission
                      </span>
                    ) : (
                      effective.map((p) => (
                        <span
                          key={p}
                          className="text-[10px] rounded-full px-2 py-0.5"
                          style={{ backgroundColor: palette.elevated, color: palette.muted }}
                        >
                          {PERMISSION_LABELS[p] ?? p}
                        </span>
                      ))
                    )}
                  </div>
                )}

                {editingId === a.id && (
                  <div className="mt-3 pt-3 space-y-2" style={{ borderTop: `1px solid ${palette.line}` }}>
                    <PermissionPicker
                      selected={editPerms}
                      onToggle={(k) => setEditPerms((p) => togglePerm(p, k))}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => savePermissions(a.id)}
                        className="flex-1 rounded-lg text-white text-xs font-semibold py-2"
                        style={{ backgroundColor: "#7C5CFF" }}
                      >
                        Enregistrer
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 rounded-lg border text-xs font-medium py-2"
                        style={{ borderColor: palette.line, color: palette.ink }}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Donner accès */}
        {!showGrant ? (
          <button
            onClick={() => { setShowGrant(true); setMessage(null); }}
            className="w-full rounded-xl text-white text-sm font-medium py-2.5"
            style={{ backgroundColor: "#7C5CFF" }}
          >
            Donner accès à Margitrack
          </button>
        ) : (
          <form onSubmit={submitGrant} className="rounded-2xl p-4 space-y-3" style={card}>
            <p className="text-sm font-semibold" style={{ color: palette.ink }}>
              Donner accès à une personne
            </p>

            {membersWithoutAccess.length > 0 && (
              <div>
                <label className="text-xs" style={{ color: palette.muted }}>
                  Employé existant (facultatif)
                </label>
                <select
                  value={grant.teamMemberId}
                  onChange={(e) => {
                    const m = members.find((x) => x.id === e.target.value);
                    setGrant((g) => ({
                      ...g,
                      teamMemberId: e.target.value,
                      fullName: m?.full_name ?? g.fullName,
                      phone: m?.phone ?? g.phone,
                    }));
                  }}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  style={input}
                >
                  <option value="">— Nouvelle personne —</option>
                  {membersWithoutAccess.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} — {m.role}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <input
              value={grant.email}
              onChange={(e) => setGrant((g) => ({ ...g, email: e.target.value }))}
              type="email"
              placeholder="Adresse email"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={input}
            />
            <input
              value={grant.fullName}
              onChange={(e) => setGrant((g) => ({ ...g, fullName: e.target.value }))}
              placeholder="Nom complet"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={input}
            />

            <div>
              <label className="text-xs" style={{ color: palette.muted }}>Rôle</label>
              <select
                value={grant.role}
                onChange={(e) => setGrant((g) => ({ ...g, role: e.target.value }))}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                style={input}
              >
                {allRoles.map((r) => (
                  <option key={r.code} value={r.code}>{r.label}</option>
                ))}
              </select>
              <p className="text-[11px] mt-1" style={{ color: palette.muted }}>
                Droits par défaut :{" "}
                {(customRoles.find((r) => r.code === grant.role)?.permissions ??
                  defaultPermissionsFor(grant.role))
                  .map((p) => PERMISSION_LABELS[p] ?? p)
                  .join(", ") || "aucun"}
              </p>
            </div>

            <label className="flex items-center gap-2 text-xs" style={{ color: palette.ink }}>
              <input
                type="checkbox"
                checked={grant.useCustomPermissions}
                onChange={(e) =>
                  setGrant((g) => ({
                    ...g,
                    useCustomPermissions: e.target.checked,
                    permissions: e.target.checked ? defaultPermissionsFor(g.role) : [],
                  }))
                }
              />
              Personnaliser les permissions de cette personne
            </label>

            {grant.useCustomPermissions && (
              <PermissionPicker
                selected={grant.permissions}
                onToggle={(k) =>
                  setGrant((g) => ({ ...g, permissions: togglePerm(g.permissions, k) }))
                }
              />
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl text-white text-sm font-medium py-2.5 disabled:opacity-50"
                style={{ backgroundColor: "#7C5CFF" }}
              >
                {saving ? "Envoi..." : "Envoyer l'invitation"}
              </button>
              <button
                type="button"
                onClick={() => { setShowGrant(false); setGrant(emptyGrant); }}
                className="flex-1 rounded-xl border text-sm font-medium py-2.5"
                style={{ borderColor: palette.line, color: palette.ink }}
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        {/* Rôles personnalisés */}
        <div className="rounded-2xl p-4 space-y-3" style={card}>
          <p className="text-sm font-semibold" style={{ color: palette.ink }}>
            Rôles personnalisés
          </p>

          {customRoles.length === 0 && !showRoleForm && (
            <p className="text-xs" style={{ color: palette.muted }}>
              Aucun rôle personnalisé pour l'instant.
            </p>
          )}

          {customRoles.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm" style={{ color: palette.ink }}>{r.label}</p>
                <p className="text-[11px]" style={{ color: palette.muted }}>
                  {(r.permissions ?? []).map((p) => PERMISSION_LABELS[p] ?? p).join(", ") || "aucune permission"}
                </p>
              </div>
              <button
                onClick={async () => {
                  await supabase.from("custom_roles").delete().eq("id", r.id);
                  await load();
                }}
                className="text-xs text-rose-500 shrink-0"
              >
                Supprimer
              </button>
            </div>
          ))}

          {showRoleForm ? (
            <form onSubmit={createCustomRole} className="space-y-2 pt-2" style={{ borderTop: `1px solid ${palette.line}` }}>
              <input
                value={newRole.label}
                onChange={(e) => setNewRole((r) => ({ ...r, label: e.target.value }))}
                placeholder="Nom du rôle (ex : Responsable achats)"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={input}
              />
              <PermissionPicker
                selected={newRole.permissions}
                onToggle={(k) =>
                  setNewRole((r) => ({ ...r, permissions: togglePerm(r.permissions, k) }))
                }
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl text-white text-sm font-medium py-2.5"
                  style={{ backgroundColor: "#7C5CFF" }}
                >
                  Créer le rôle
                </button>
                <button
                  type="button"
                  onClick={() => setShowRoleForm(false)}
                  className="flex-1 rounded-xl border text-sm font-medium py-2.5"
                  style={{ borderColor: palette.line, color: palette.ink }}
                >
                  Annuler
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowRoleForm(true)}
              className="text-sm font-medium"
              style={{ color: "#7C5CFF" }}
            >
              + Créer un rôle personnalisé
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
