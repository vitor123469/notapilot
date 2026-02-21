import { CompanySettingsClient } from "./CompanySettingsClient";

export const dynamic = "force-dynamic";

export default async function CompanySettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CompanySettingsClient companyId={id} />;
}
