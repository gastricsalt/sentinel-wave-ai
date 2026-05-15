import { useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
};

export function useAuth(): AuthState & {
  signOut: () => Promise<void>;
} {
  const [state, setState] = useState<AuthState>({ loading: true, session: null, user: null });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setState({ loading: false, session, user: session?.user ?? null });
    });
    supabase.auth.getSession().then(({ data }) => {
      setState({ loading: false, session: data.session, user: data.session?.user ?? null });
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { ...state, signOut };
}
