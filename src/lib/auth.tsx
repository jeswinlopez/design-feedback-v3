import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
}

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** Authenticated AND has an admin profile row (seed-only gating, §3). */
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // Monotonic guard so overlapping auth events (initial getSession racing an
    // onAuthStateChange, sign-out racing an in-flight load) can't let a stale profile win.
    let loadSeq = 0;

    async function loadProfile(s: Session | null) {
      const seq = ++loadSeq;
      if (!s) {
        if (active && seq === loadSeq) setProfile(null);
        return;
      }
      // RLS allows reading only your own row; no row => not an admin.
      const { data } = await supabase
        .from("profiles")
        .select("id, email, name, role")
        .eq("id", s.user.id)
        .maybeSingle();
      // Only apply if this is still the most recent load.
      if (active && seq === loadSeq) setProfile((data as Profile) ?? null);
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!active) return;
      setSession(s);
      await loadProfile(s);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    session,
    profile,
    loading,
    isAdmin: !!session && !!profile && profile.role === "admin",
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
