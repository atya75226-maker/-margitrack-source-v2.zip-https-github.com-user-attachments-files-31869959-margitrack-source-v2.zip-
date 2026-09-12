import { useMemo } from "react";
import { useRealtimeCollection } from "./useRealtimeCollection";

export function useSales(restaurantId, options = {}) {
  const { branchId = null, dateFrom = null, dateTo = null } = options;
  const filters = useMemo(() => {
    const f = [];
    if (branchId) f.push({ column: "branch_id", operator: "eq", value: branchId });
    if (dateFrom) f.push({ column: "sale_date", operator: "gte", value: dateFrom });
    if (dateTo) f.push({ column: "sale_date", operator: "lte", value: dateTo });
    return f;
  }, [branchId, dateFrom, dateTo]);

  const { rows: sales, loading, loadingMore, error, hasMore, loadMore, insert, remove } = useRealtimeCollection({
    table: "sales", restaurantId, orderBy: "created_at", ascending: false, filters,
  });

  const addSalesBatch = async (items) => {
    const payload = items.map((it) => ({ restaurant_id: restaurantId, branch_id: branchId, product_id: it.productId, quantity: it.quantity, sale_date: it.date }));
    await insert(payload);
  };
  const deleteSale = async (sale) => { await remove(sale.id); };

  return { sales, loading, loadingMore, error, hasMore, loadMore, addSalesBatch, deleteSale };
}
