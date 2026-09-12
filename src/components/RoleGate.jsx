import { useAuth } from "../contexts/AuthContext";

export function RoleGate({ allow, children, fallback = null }) {
  const { role } = useAuth();
  if (!role || !allow.includes(role)) return fallback;
  return children;
}
