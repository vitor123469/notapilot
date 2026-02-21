"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useSession } from "../../lib/auth/useSession";
import { clearActiveTenantId } from "../../lib/tenancy/activeTenant";
import { getSupabaseBrowser } from "../../lib/supabase/browserClient";
import { useActiveTenant } from "../../lib/tenancy/useActiveTenant";

export function AuthGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isLoading } = useSession();
  const { tenantId, isLoading: isTenantLoading, error: tenantError } = useActiveTenant();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  const navItems = [
    { href: "/app", label: "Dashboard" },
    { href: "/app/companies", label: "Empresas" },
    { href: "/app/clients", label: "Clientes" },
    { href: "/app/nfses", label: "NFS-e" },
  ];

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/auth/login");
    }
  }, [isLoading, router, session]);

  async function handleSignOut() {
    setSignOutError("");
    setIsSigningOut(true);
    const supabase = getSupabaseBrowser();
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
          <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    textDecoration: "none",
                    border: isActive ? "1px solid #111" : "1px solid transparent",
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {tenantId ? <span>Tenant: {tenantId.slice(0, 6)}</span> : null}
          {session?.user?.email ? <span>{session.user.email}</span> : null}
        </div>

        <button onClick={handleSignOut} disabled={isSigningOut}>
          {isSigningOut ? "Saindo..." : "Sair"}
        </button>
      </header>

      {signOutError ? <p style={{ color: "crimson", marginBottom: 12 }}>{signOutError}</p> : null}
      {isLoading || isTenantLoading ? <p>Carregando...</p> : null}
      {!isLoading && !isTenantLoading && tenantError ? (
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ color: "crimson", margin: 0 }}>{tenantError}</p>
          <button type="button" onClick={() => router.refresh()}>
            Recarregar
          </button>
        </div>
      ) : null}
      {!isLoading && !isTenantLoading && session && tenantId && !tenantError ? children : null}
    </div>
  );
}
