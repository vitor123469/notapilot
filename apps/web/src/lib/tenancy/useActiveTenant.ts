"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "../auth/useSession";
import { getSupabaseBrowser } from "../supabase/browserClient";
import { getActiveTenantId, setActiveTenantId } from "./activeTenant";

type UseActiveTenantResult = {
  tenantId: string | null;
  isLoading: boolean;
  error: string;
};

export function useActiveTenant(): UseActiveTenantResult {
  const router = useRouter();
  const { session, isLoading: isSessionLoading } = useSession();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const initializedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (isSessionLoading) return;

    if (!session?.user) {
      setIsLoading(false);
      router.replace("/auth/login");
      return;
    }

    if (initializedForUserRef.current === session.user.id) return;
    initializedForUserRef.current = session.user.id;

    let isCancelled = false;

    const loadMemberships = async () => {
      setError("");
      setIsLoading(true);

      const supabase = getSupabaseBrowser();
      const { data, error: membershipsError } = await supabase
        .from("tenant_members")
        .select("tenant_id, role")
        .eq("user_id", session.user.id);

      if (isCancelled) return;

      if (membershipsError) {
        setError("Não foi possível validar o tenant ativo. Tente recarregar.");
        setIsLoading(false);
        return;
      }

      const tenantIds = (data ?? []).map((membership) => membership.tenant_id);
      if (tenantIds.length === 0) {
        setTenantId(null);
        setIsLoading(false);
        router.replace("/app/onboarding");
        return;
      }

      const localTenantId = getActiveTenantId();
      const hasValidStoredTenant = Boolean(localTenantId && tenantIds.includes(localTenantId));
      const resolvedTenantId = hasValidStoredTenant ? (localTenantId as string) : (tenantIds[0] as string);

      if (!hasValidStoredTenant) {
        setActiveTenantId(resolvedTenantId);
        console.log("Tenant ativo corrigido");
      }

      setTenantId(resolvedTenantId);
      setIsLoading(false);
    };

    loadMemberships().catch(() => {
      if (isCancelled) return;
      setError("Não foi possível validar o tenant ativo. Tente recarregar.");
      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [isSessionLoading, router, session?.user?.id]);

  return { tenantId, isLoading, error };
}
