import { useMemo } from "react";
import { useRealtimeCollection } from "./useRealtimeCollection";

export function useExpenses(restaurantId, options = {}) {
  const { branchId = null, category = null, dateFrom = null, dateTo = null } = options;
  const filters = useMemo(() => {
    const f = [];
    if (branchId) f.push({ column: "branch_id", operator: "eq", value: branchId });
    if (category) f.push({ column: "category", operator: "eq", value: category });
    if (dateFrom) f.push({ column: "expense_date", operator: "gte", value: dateFrom });
    if (dateTo) f.push({ column: "expense_date", operator: "lte", value: dateTo });
    return f;
  }, [branchId, category, dateFrom, dateTo]);

  const { rows: expenses, loading, loadingMore, error, hasMore, loadMore, insert, remove } = useRealtimeCollection({
    table: "expenses", restaurantId, orderBy: "created_at", ascending: false, filters,
  });

  const addExpense = async ({ category: cat, amount, date, description }) => {
    await insert({ restaurant_id: restaurantId, branch_id: branchId, category: cat, amount, expense_date: date, description: description ?? null });
  };
  const deleteExpense = async (expense) => { await remove(expense.id); };

  return { expenses, loading, loadingMore, error, hasMore, loadMore, addExpense, deleteExpense };
}
