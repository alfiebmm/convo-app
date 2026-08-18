import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth-context";
import { withDashboardErrorLogging } from "@/lib/errors/wrap";
import { BrandForm } from "./brand-form";

async function BrandSettingsPageImpl() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const settings =
    typeof tenant.settings === "object" &&
    tenant.settings !== null &&
    !Array.isArray(tenant.settings)
      ? (tenant.settings as Record<string, unknown>)
      : {};
  const brandJson =
    typeof settings.brandJson === "object" &&
    settings.brandJson !== null &&
    !Array.isArray(settings.brandJson)
      ? (settings.brandJson as Record<string, unknown>)
      : {};
  const logo =
    typeof brandJson.logo === "object" &&
    brandJson.logo !== null &&
    !Array.isArray(brandJson.logo)
      ? (brandJson.logo as Record<string, unknown>)
      : {};
  const colours =
    typeof brandJson.colors === "object" &&
    brandJson.colors !== null &&
    !Array.isArray(brandJson.colors)
      ? (brandJson.colors as Record<string, unknown>)
      : {};

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Brand</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage the logo and organisation details used in generated articles.
        </p>
      </header>

      <BrandForm
        tenantName={tenant.name}
        tenantDomain={tenant.domain ?? ""}
        initialValues={{
          logoUrl: typeof logo.url === "string" ? logo.url : "",
          logoAlt: typeof logo.alt === "string" ? logo.alt : tenant.name,
          siteName:
            typeof brandJson.name === "string" ? brandJson.name : tenant.name,
          primaryColor:
            typeof colours.primary === "string" ? colours.primary : "#FF6B2C",
        }}
      />
    </div>
  );
}

export default withDashboardErrorLogging(BrandSettingsPageImpl, {
  route: "/dashboard/settings/brand",
});
