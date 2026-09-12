import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

const queryCache = new Map();
const DEFAULT_STALE_TIME_MS = 30_000;
const DEFAULT_PAGE_SIZE = 50;

function buildCacheKey({ table, restaurantId, orderBy, ascending, filters, search }) {
  return JSON.stringify({ table, restaurantId, orderBy, ascending, filters, search });
}

function toFriendlyError(rawError, context) {
  if (!rawError) return null;
  const pgCode = rawError.code;
  let code = "unknown";
  let message = `Une erreur est survenue (${context}).`;
  if (pgCode === "42501" || rawError.status === 401 || rawError.status === 403) { code = "permission_denied"; message = "Vous n'avez pas la permission d'effectuer cette action."; }
  else if (pgCode === "23505") { code = "duplicate"; message = "Cet élément existe déjà."; }
  else if (pgCode === "23503") { code = "invalid_reference"; message = "Cette action fait référence à un élément qui n'existe plus."; }
  else if (rawError.message?.toLowerCase().includes("failed to fetch") || rawError.message?.toLowerCase().includes("network")) { code = "network_error"; message = "Connexion impossible. Vérifiez votre connexion internet."; }
  else if (rawError.message) { message = rawError.message; }
  return { code, message, context, raw: rawError };
}

function applyFilters(query, filters) {
  for (const f of filters) {
    switch (f.operator) {
      case "eq": query = query.eq(f.column, f.value); break;
      case "neq": query = query.neq(f.column, f.value); break;
      case "gt": query = query.gt(f.column, f.value); break;
      case "gte": query = query.gte(f.column, f.value); break;
      case "lt": query = query.lt(f.column, f.value); break;
      case "lte": query = query.lte(f.column, f.value); break;
      case "in": query = query.in(f.column, f.value); break;
      case "ilike": query = query.ilike(f.column, `%${f.value}%`); break;
      default: break;
    }
  }
  return query;
}

export function useRealtimeCollection({ table, restaurantId, orderBy = "created_at", ascending = false, pageSize = DEFAULT_PAGE_SIZE, filters = [], search = null, staleTime = DEFAULT_STALE_TIME_MS }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const filtersKey = JSON.stringify(filters);
  const searchKey = JSON.stringify(search);
  const cacheKey = buildCacheKey({ table, restaurantId, orderBy, ascending, filters, search });

  const pageRef = useRef(0);
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(async (pageIndex) => {
    const from = pageIndex * pageSize;
    const to = from + pageSize;
    let query = supabase.from(table).select("*").eq("restaurant_id", restaurantId);
    query = applyFilters(query, filters);
    if (search?.value) query = query.ilike(search.column, `%${search.value}%`);
    query = query.order(orderBy, { ascending }).range(from, to);
    return query;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, restaurantId, orderBy, ascending, filtersKey, searchKey, pageSize]);

  const reload = useCallback(async () => {
    if (!restaurantId) { setRows([]); setHasMore(false); setLoading(false); setError(null); return; }
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    const { data, error: fetchError } = await fetchPage(0);
    if (currentRequestId !== requestIdRef.current) return;
    if (fetchError) { setError(toFriendlyError(fetchError, `chargement (${table})`)); setLoading(false); return; }
    const pageData = data ?? [];
    const more = pageData.length > pageSize;
    const pageRows = more ? pageData.slice(0, pageSize) : pageData;
    pageRef.current = 1;
    setRows(pageRows); setHasMore(more); setError(null); setLoading(false);
    queryCache.set(cacheKey, { rows: pageRows, hasMore: more, fetchedAt: Date.now() });
  }, [restaurantId, fetchPage, pageSize, table, cacheKey]);

  useEffect(() => {
    const cached = queryCache.get(cacheKey);
    if (cached) {
      pageRef.current = 1;
      setRows(cached.rows); setHasMore(cached.hasMore); setLoading(false); setError(null);
      const isStale = Date.now() - cached.fetchedAt > staleTime;
      if (isStale) reload();
    } else { reload(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, staleTime]);

  const loadMore = useCallback(async () => {
    if (!restaurantId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = pageRef.current;
    const { data, error: fetchError } = await fetchPage(nextPage);
    if (fetchError) { setError(toFriendlyError(fetchError, `chargement page suivante (${table})`)); setLoadingMore(false); return; }
    const pageData = data ?? [];
    const more = pageData.length > pageSize;
    const pageRows = more ? pageData.slice(0, pageSize) : pageData;
    pageRef.current = nextPage + 1;
    setRows((prev) => [...prev, ...pageRows]);
    setHasMore(more); setLoadingMore(false);
  }, [restaurantId, loadingMore, hasMore, fetchPage, pageSize, table]);

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`${table}-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table, filter: `restaurant_id=eq.${restaurantId}` }, (payload) => {
        setRows((prev) => {
          let next = prev;
          switch (payload.eventType) {
            case "INSERT": { if (prev.some((r) => r.id === payload.new.id)) break; next = ascending ? [...prev, payload.new] : [payload.new, ...prev]; break; }
            case "UPDATE": next = prev.map((r) => (r.id === payload.new.id ? payload.new : r)); break;
            case "DELETE": next = prev.filter((r) => r.id !== payload.old.id); break;
            default: break;
          }
          const cached = queryCache.get(cacheKey);
          if (cached) queryCache.set(cacheKey, { ...cached, rows: next });
          return next;
        });
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setError(toFriendlyError({ message: "La synchronisation en temps réel a été interrompue. Les données affichées peuvent ne plus être à jour." }, table));
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [table, restaurantId, ascending, cacheKey]);

  const insert = useCallback(async (payload) => {
    const { data, error: insertError } = await supabase.from(table).insert(payload).select();
    if (insertError) throw toFriendlyError(insertError, `création (${table})`);
    return data;
  }, [table]);

  const update = useCallback(async (id, patch) => {
    const { data, error: updateError } = await supabase.from(table).update(patch).eq("id", id).select();
    if (updateError) throw toFriendlyError(updateError, `modification (${table})`);
    return data;
  }, [table]);

  const remove = useCallback(async (id) => {
    const { error: deleteError } = await supabase.from(table).delete().eq("id", id);
    if (deleteError) throw toFriendlyError(deleteError, `suppression (${table})`);
  }, [table]);

  return { rows, loading, loadingMore, error, hasMore, loadMore, reload, insert, update, remove };
}
