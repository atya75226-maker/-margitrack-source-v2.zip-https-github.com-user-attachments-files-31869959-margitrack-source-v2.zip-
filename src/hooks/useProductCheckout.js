import { useCallback } from "react";
import { callEdgeFunction } from "../lib/supabaseClient";

export function useProductCheckout() {
  const startCheckout = useCallback(async ({ productId, email, nom, telephone }) => {
    const body = await callEdgeFunction("checkout", { body: { product_id: productId, email, nom, telephone } });
    return { checkoutUrl: body.checkout_url, orderId: body.order_id };
  }, []);
  return { startCheckout };
}
