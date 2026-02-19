"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSession } from "../../src/lib/auth/useSession";
import { clearActiveTenantId } from "../../src/lib/tenancy/activeTenant";
import { createBrowserSupabaseClient } from "../../src/lib/supabase/browserClient";

export default function ProtectedAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const { session, isLoading } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/auth/login");
    }
  }, [isLoading, router, session]);

  async function handleSignOut() {
    setSignOutError("");
    setIsSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setIsSigningOut(false);

    if (error) {
      setSignOutError(error.message);
      return;
    }

    clearActiveTenantId();
    router.replace("/");
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/app">
            <strong>NotaPilot</strong>
          </Link>
          {session?.user?.email ? <span>{session.user.email}</span> : null}
        </div>

        <button onClick={handleSignOut} disabled={isSigningOut}>
          {isSigningOut ? "Saindo..." : "Sair"}
        </button>
      </header>

      {signOutError ? <p style={{ color: "crimson", marginBottom: 12 }}>{signOutError}</p> : null}

      {!session ? <p>Validando sessão...</p> : isLoading ? <p>Carregando sessão...</p> : children}
    </div>
  );
}
