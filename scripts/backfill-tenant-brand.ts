import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inArray, or } from "drizzle-orm";

function loadLocalEnv() {
  for (const path of [
    resolve(process.cwd(), ".env.local"),
    resolve(process.env.HOME ?? "", ".openclaw/workspace/.env.local"),
  ]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  settings: unknown;
};

async function main() {
  loadLocalEnv();

  const [{ db }, { tenants }, { fetchTenantBrand }] = await Promise.all([
    import("../src/lib/db"),
    import("../src/lib/db/schema"),
    import("../src/lib/knowledge/brand-fetcher"),
  ]);

  const targets = [
    {
      label: "Doggo",
      domain: "https://doggo.com.au",
      slug: "doggo",
      domainVariants: ["doggo.com.au", "https://doggo.com.au"],
    },
    {
      label: "AgPages",
      domain: "https://www.agpages.com.au",
      slug: "agpages",
      domainVariants: [
        "agpages.com.au",
        "www.agpages.com.au",
        "https://www.agpages.com.au",
      ],
    },
  ];

  for (const target of targets) {
    const [tenant] = (await db
      .select()
      .from(tenants)
      .where(
        or(
          inArray(tenants.slug, [target.slug, target.label.toLowerCase()]),
          inArray(tenants.domain, target.domainVariants),
        ),
      )
      .limit(1)) as TenantRow[];

    const result = await fetchTenantBrand(target.domain);
    console.log(
      `${target.label}: fetched ${result.logo?.url ?? "no logo"} (${result.logo?.source ?? "none"})`,
    );
    if (result.siteName) console.log(`${target.label}: siteName ${result.siteName}`);
    if (result.themeColor) {
      console.log(`${target.label}: themeColor ${result.themeColor}`);
    }
    if (result.errors.length > 0) {
      console.log(`${target.label}: errors ${result.errors.join("; ")}`);
    }

    if (!tenant) {
      console.log(`${target.label}: tenant row not found, skipped DB update`);
      continue;
    }
    if (!result.logo) {
      console.log(`${target.label}: no logo to write`);
      continue;
    }

    const settings = isRecord(tenant.settings) ? tenant.settings : {};
    const existingBrandJson = isRecord(settings.brandJson)
      ? settings.brandJson
      : {};
    const brandJson: Record<string, unknown> = {
      ...existingBrandJson,
      id: tenant.slug,
      name: result.siteName || tenant.name,
      logo: {
        url: result.logo.url,
        alt: result.logo.alt,
        height: 30,
      },
    };
    if (result.themeColor) {
      brandJson.colors = {
        ...(isRecord(existingBrandJson.colors) ? existingBrandJson.colors : {}),
        primary: result.themeColor,
      };
    }

    await db
      .update(tenants)
      .set({
        settings: { ...settings, brandJson },
        updatedAt: new Date(),
      })
      .where(inArray(tenants.id, [tenant.id]));
    console.log(`${target.label}: updated tenant ${tenant.id}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
