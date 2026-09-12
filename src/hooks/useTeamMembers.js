import { useRealtimeCollection } from "./useRealtimeCollection";

// Un employé enregistré ici (table team_members) N'EST PAS automatiquement
// un utilisateur pouvant se connecter à Margitrack — c'est une fiche de
// personnel (nom, métier, salaire...), distincte des comptes profils/auth.
// Le métier (role) est un texte libre : le propriétaire peut créer
// n'importe quel intitulé ("Agent d'approvisionnement", "Livreur", etc.).
export function useTeamMembers(restaurantId) {
  const { rows: members, loading, error, insert, update, remove } = useRealtimeCollection({
    table: "team_members", restaurantId, orderBy: "created_at", ascending: true,
  });

  const addMember = async ({ name, role, phone, monthlySalary, hireDate, isActive = true }) => {
    await insert({
      restaurant_id: restaurantId,
      full_name: name,
      role,
      phone: phone || null,
      monthly_salary: monthlySalary === "" || monthlySalary == null ? null : monthlySalary,
      hire_date: hireDate || null,
      is_active: isActive,
    });
  };

  const updateMember = async (id, { name, role, phone, monthlySalary, hireDate, isActive }) => {
    const patch = {};
    if (name !== undefined) patch.full_name = name;
    if (role !== undefined) patch.role = role;
    if (phone !== undefined) patch.phone = phone || null;
    if (monthlySalary !== undefined) patch.monthly_salary = monthlySalary === "" || monthlySalary == null ? null : monthlySalary;
    if (hireDate !== undefined) patch.hire_date = hireDate || null;
    if (isActive !== undefined) patch.is_active = isActive;
    await update(id, patch);
  };

  const removeMember = async (member) => { await remove(member.id); };

  return { members, loading, error, addMember, updateMember, removeMember };
}
