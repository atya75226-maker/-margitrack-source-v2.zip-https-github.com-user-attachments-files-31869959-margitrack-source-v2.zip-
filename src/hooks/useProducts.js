import { useMemo } from "react";
import { useRealtimeCollection } from "./useRealtimeCollection";

export function useProducts(restaurantId, options = {}) {
  const { branchId = null, searchTerm = "" } = options;
  const filters = useMemo(() => {
    const f = [];
    if (branchId) f.push({ column: "branch_id", operator: "eq", value: branchId });
    return f;
  }, [branchId]);
  const search = useMemo(() => (searchTerm ? { column: "name", value: searchTerm } : null), [searchTerm]);

  const { rows: products, loading, loadingMore, error, hasMore, loadMore, insert, update, remove } = useRealtimeCollection({
    table: "products", restaurantId, orderBy: "name", ascending: true, filters, search,
  });

  const addProduct = async ({ name, price, branchId: productBranchId }) => {
    await insert({ restaurant_id: restaurantId, branch_id: productBranchId ?? branchId ?? null, name, price });
  };
  const updateProduct = async (id, patch) => { await update(id, patch); };
  const deleteProduct = async (product) => { await remove(product.id); };

  return { products, loading, loadingMore, error, hasMore, loadMore, addProduct, updateProduct, deleteProduct };
}
