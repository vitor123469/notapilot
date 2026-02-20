import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./db.types";

declare global {
  var __notapilotSupabaseBrowser__: SupabaseClient<Database> | undefined;
}

export function getSupabaseBrowser(): SupabaseClient<Database> {
  if (globalThis.__notapilotSupabaseBrowser__) {
    return globalThis.__notapilotSupabaseBrowser__;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL não definida.");
  }
  if (!supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY não definida.");
  }

  globalThis.__notapilotSupabaseBrowser__ = createClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "notapilot-auth",
      },
    }
  );

  return globalThis.__notapilotSupabaseBrowser__;
}
