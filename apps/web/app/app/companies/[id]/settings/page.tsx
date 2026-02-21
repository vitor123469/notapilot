import { CompanySettingsClient } from "./CompanySettingsClient";

export const dynamic = "force-dynamic";

export default async function CompanySettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  return <CompanySettingsClient companyId={id} returnTo={returnTo} />;
}
