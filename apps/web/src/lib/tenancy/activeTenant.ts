const ACTIVE_TENANT_KEY = "np_activeTenantId";

export function getActiveTenantId(): string | null {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem(ACTIVE_TENANT_KEY);
  }
  return null;
}

export function setActiveTenantId(tenantId: string): string | null {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
    return tenantId;
  }
  return null;
}

export function clearActiveTenantId(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ACTIVE_TENANT_KEY);
  }
}
