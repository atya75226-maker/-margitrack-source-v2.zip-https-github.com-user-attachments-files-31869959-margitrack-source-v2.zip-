import { useEffect, useState, useCallback } from "react";
import { supabase, callEdgeFunction } from "../lib/supabaseClient";

export function useSubscription(restaurantId) {
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!restaurantId) { setSubscription(null); setLoading(false); return; }
    setLoading(true);
    const [{ data: sub, error: subError }, { data: planRows, error: planError }] = await Promise.all([
      supabase.from("subscriptions").select("*").eq("restaurant_id", restaurantId).maybeSingle(),
      supabase.from("plans").select("*").eq("is_active", true).order("price_fcfa", { ascending: true }),
    ]);
    if (subError) setError(subError.message); else setSubscription(sub);
    if (!planError) setPlans(planRows ?? []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`subscription-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `restaurant_id=eq.${restaurantId}` }, (payload) => setSubscription(payload.new ?? null))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [restaurantId]);

  const now = new Date();
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const notExpired = !periodEnd || periodEnd > now;

  const isTrial = subscription?.status === "trial" && notExpired;
  const isActive = (subscription?.status === "active" || isTrial) && notExpired;
  const daysRemaining = periodEnd ? Math.max(0, Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24))) : null;
  const isExpired = subscription?.status === "expired" || (subscription != null && !notExpired);
  const isRevoked = subscription?.status === "revoked";

  const subscribeViaChariow = useCallback(async (planId, payer) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Vous devez être connecté.");
    const body = await callEdgeFunction("chariow-checkout", {
      token: session.access_token,
      body: { plan_id: planId, first_name: payer.firstName, last_name: payer.lastName, phone_number: payer.phoneNumber, phone_country_code: payer.phoneCountryCode },
    });
    return body.checkout_url;
  }, []);

  return { subscription, plans, loading, error, isActive, isTrial, isExpired, isRevoked, daysRemaining, subscribeViaChariow, reload: load };
}
