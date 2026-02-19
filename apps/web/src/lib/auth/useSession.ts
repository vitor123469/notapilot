"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { createBrowserSupabaseClient } from "../supabase/browserClient";

export function useSession() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        setSession(null);
        setIsLoading(false);
        return;
      }
      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return { session, isLoading };
}
