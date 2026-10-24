"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";

interface AuthState {
  /** False until the first session check has finished. */
  ready: boolean;
  user: User | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setReady(true);
      return;
    }
    let disposed = false;
    supabase.auth.getUser().then(({ data }) => {
      if (disposed) return;
      setUser(data.user ?? null);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (disposed) return;
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => {
      disposed = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(() => ({ ready, user, signOut }), [ready, user, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
