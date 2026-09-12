import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, callEdgeFunction } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileChecked, setProfileChecked] = useState(false);
  const [ownerSetupError, setOwnerSetupError] = useState(null);

  const loadProfile = useCallback(async (userId) => {
    const { data: profileRow } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile(profileRow ?? null);

    if (profileRow?.restaurant_id) {
      const { data: restaurantRow } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", profileRow.restaurant_id)
        .single();
      setRestaurant(restaurantRow ?? null);
    } else {
      setRestaurant(null);
    }
    setProfileChecked(true);
    return profileRow ?? null;
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      setSession(session);
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
        setRestaurant(null);
        setProfileChecked(false);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  useEffect(() => {
    if (!session?.user) return;
    const channel = supabase
      .channel(`profile-${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${session.user.id}` },
        (payload) => setProfile(payload.new)
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [session?.user?.id]);

  const signUpOwner = useCallback(async ({ email, password, fullName, restaurantName }) => {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, restaurant_name: restaurantName } },
    });
    if (signUpError) throw signUpError;

    if (!signUpData.session) {
      return { requiresEmailConfirmation: true };
    }

    await completeOwnerSetupRef.current(signUpData.user.id, { fullName, restaurantName });
    return { requiresEmailConfirmation: false };
  }, []);

  const completeOwnerSetup = useCallback(async (userId, { fullName, restaurantName }) => {
    const existing = await loadProfile(userId);
    if (existing) return existing;

    const { data, error } = await supabase.rpc("create_owner_restaurant", {
      p_restaurant_name: restaurantName,
      p_full_name: fullName,
    });
    if (error) throw error;

    void data;
    return loadProfile(userId);
  }, [loadProfile]);

  const completeOwnerSetupRef = React.useRef();
  useEffect(() => { completeOwnerSetupRef.current = completeOwnerSetup; }, [completeOwnerSetup]);

  useEffect(() => {
    if (!session?.user || !profileChecked || profile) return;

    const meta = session.user.user_metadata ?? {};
    const restaurantName =
      meta.restaurant_name ||
      (meta.full_name || meta.name ? `Restaurant de ${meta.full_name || meta.name}` : "Mon restaurant");

    setOwnerSetupError(null);
    completeOwnerSetup(session.user.id, {
      fullName: meta.full_name || meta.name || "",
      restaurantName,
    }).catch((err) => {
      setOwnerSetupError(err.message || "Impossible de créer votre restaurant.");
    });
  }, [session?.user, profileChecked, profile, completeOwnerSetup]);

  const retryOwnerSetup = useCallback(async () => {
    if (!session?.user) return;
    setOwnerSetupError(null);
    const meta = session.user.user_metadata ?? {};
    const restaurantName =
      meta.restaurant_name ||
      (meta.full_name || meta.name ? `Restaurant de ${meta.full_name || meta.name}` : "Mon restaurant");
    try {
      await completeOwnerSetup(session.user.id, {
        fullName: meta.full_name || meta.name || "",
        restaurantName,
      });
    } catch (err) {
      setOwnerSetupError(err.message || "Impossible de créer votre restaurant.");
    }
  }, [session, completeOwnerSetup]);

  const signIn = useCallback(async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const inviteStaff = useCallback(async ({ email, fullName, role, phone }) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    return callEdgeFunction("invite-staff", {
      token: currentSession?.access_token,
      body: { email, full_name: fullName, role, phone: phone || null },
    });
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    restaurant,
    loading,
    isAuthenticated: !!session,
    ownerSetupError,
    role: profile?.role ?? null,
    restaurantId: profile?.restaurant_id ?? null,
    signUpOwner,
    signIn,
    signInWithGoogle,
    signOut,
    inviteStaff,
    completeOwnerSetup,
    retryOwnerSetup,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() doit être utilisé à l'intérieur de <AuthProvider>");
  return ctx;
}
