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
  const { session, isLoading } = useSession();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isTenantLoading, setIsTenantLoading] = useState(true);
  const [error, setError] = useState("");
  const initializedForUserRef = useRef<string | null>(null);
  const userId = session?.user?.id;

  useEffect(() => {
    if (isLoading) return;

    if (!userId) {
      setIsTenantLoading(false);
      router.replace("/auth/login");
      return;
    }

    if (initializedForUserRef.current === userId) return;
    initializedForUserRef.current = userId;

    let isCancelled = false;

    const loadMemberships = async () => {
      setError("");
      setIsTenantLoading(true);

      const supabase = getSupabaseBrowser();
      const { data, error: membershipsError } = await supabase
        .from("tenant_members")
        .select("tenant_id, role")
        .eq("user_id", userId);

      if (isCancelled) return;

      if (membershipsError) {
        setError("Não foi possível validar o tenant ativo. Tente recarregar.");
        setIsTenantLoading(false);
        return;
      }

      const tenantIds = (data ?? []).map((membership) => membership.tenant_id);
      if (tenantIds.length === 0) {
        setTenantId(null);
        setIsTenantLoading(false);
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
      setIsTenantLoading(false);
    };

    loadMemberships().catch(() => {
      if (isCancelled) return;
      setError("Não foi possível validar o tenant ativo. Tente recarregar.");
      setIsTenantLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [isLoading, userId, router]);

  return { tenantId, isLoading: isTenantLoading, error };
}
