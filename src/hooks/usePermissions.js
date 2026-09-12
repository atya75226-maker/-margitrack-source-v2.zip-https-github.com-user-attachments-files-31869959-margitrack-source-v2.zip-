import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";

// Ces clés sont exactement celles utilisées par la fonction SQL
// default_permissions() et par les politiques RLS (has_perm).
// Le frontend ne fait que MASQUER ce qui est déjà interdit côté base :
// il n'est jamais la protection.
export const PERMISSION_KEYS = [
  "dashboard",
  "products",
  "sales",
  "expenses",
  "reports",
  "employees",
  "stock",
  "purchases",
  "payments",
  "settings",
];

export const PERMISSION_LABELS = {
  dashboard: "Tableau de bord",
  products: "Produits",
  sales: "Ventes",
  expenses: "Dépenses",
  reports: "Rapports",
  employees: "Employés",
  stock: "Stock",
  purchases: "Achats",
  payments: "Paiements",
  settings: "Réglages",
};

export const DEFAULT_PERMISSIONS = {
  proprietaire: [...PERMISSION_KEYS],
  gerant: ["dashboard", "products", "sales", "expenses", "reports", "employees", "stock"],
  secretaire: ["dashboard", "products", "sales", "expenses", "reports"],
  caissier: ["dashboard", "sales", "payments"],
  responsable_stock: ["stock", "products", "purchases"],
};

// Rôles pouvant recevoir un compte Margitrack.
export const ACCESS_ROLES = [
  { code: "gerant", label: "Gérant" },
  { code: "secretaire", label: "Secrétaire" },
  { code: "caissier", label: "Caissier" },
  { code: "responsable_stock", label: "Responsable de stock" },
];

export function defaultPermissionsFor(role) {
  return DEFAULT_PERMISSIONS[String(role || "").toLowerCase()] ?? [];
}

export function usePermissions() {
  const { profile, restaurantId } = useAuth();
  const [customRoles, setCustomRoles] = useState([]);

  // Les rôles personnalisés créés par le propriétaire.
  useEffect(() => {
    if (!restaurantId) {
      setCustomRoles([]);
      return;
    }
    let active = true;
    supabase
      .from("custom_roles")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .then(({ data }) => {
        if (active) setCustomRoles(data ?? []);
      });
    return () => {
      active = false;
    };
  }, [restaurantId]);

  const permissions = useMemo(() => {
    if (!profile || profile.is_active === false) return [];

    const role = String(profile.role || "").toLowerCase();
    if (role === "proprietaire") return DEFAULT_PERMISSIONS.proprietaire;

    if (Array.isArray(profile.permissions) && profile.permissions.length > 0) {
      return profile.permissions;
    }

    const custom = customRoles.find((r) => r.code === profile.role);
    if (custom) return custom.permissions ?? [];

    return defaultPermissionsFor(profile.role);
  }, [profile, customRoles]);

  const can = useMemo(() => (key) => permissions.includes(key), [permissions]);
  const isOwner = String(profile?.role || "").toLowerCase() === "proprietaire";

  return { permissions, can, isOwner, customRoles, setCustomRoles };
}
