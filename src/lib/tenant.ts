/**
 * Multi-tenant context utilities.
 * Every API/page request resolves the current tenant from the session.
 */
import { after } from "next/server";
import { db } from "./db";
import { tenants, tenantMembers } from "./db/schema";
import { eq, and } from "drizzle-orm";
import { indexTenantSite } from "./knowledge/indexer";
import { fetchTenantBrand } from "./knowledge/brand-fetcher";
import { DEFAULT_STARTER_PROMPTS } from "./forum-config/defaults";

export async function getTenantBySlug(slug: string) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  return tenant ?? null;
}

export async function getTenantById(id: string) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  return tenant ?? null;
}

export async function getUserTenants(userId: string) {
  return db
    .select({
      tenant: tenants,
      role: tenantMembers.role,
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
    .where(eq(tenantMembers.userId, userId));
}

export async function createTenant(data: {
  name: string;
  slug: string;
  domain?: string;
  ownerUserId: string;
}) {
  const tenant = await db.transaction(async (tx) => {
    // CON-252: seed forum-config starter prompts on creation so the
    // default pills materialise in the DB row (not just at read time via
    // the schema `.prefault` cascade). Matches the CON-192 forumConfig
    // auto-fill precedent. Kept as a partial `forumConfig` object so any
    // future initial-settings additions merge cleanly without clobbering.
    const initialSettings = {
      forumConfig: {
        starter_prompts: DEFAULT_STARTER_PROMPTS,
      },
    } as const;

    const [tenant] = await tx
      .insert(tenants)
      .values({
        name: data.name,
        slug: data.slug,
        domain: data.domain,
        settings: initialSettings,
      })
      .returning();

    await tx.insert(tenantMembers).values({
      tenantId: tenant.id,
      userId: data.ownerUserId,
      role: "owner",
    });

    return tenant;
  });

  // Trigger site indexing AFTER the response is sent. `after()` is Next 15+/16
  // primitive that runs work post-response on Vercel without truncating it the
  // way `setImmediate` does on serverless. Caller still gets fast tenant create.
  if (data.domain) {
    const domain = data.domain;
    after(async () => {
      await Promise.all([
        indexTenantSite(tenant.id, domain).catch((error) => {
          console.error(
            `[Tenant] Failed to index site for tenant ${tenant.id}:`,
            error
          );
        }),
        populateTenantBrand(tenant.id, tenant.slug, tenant.name, domain).catch(
          (error) => {
            console.error(
              `[Tenant] Failed to fetch brand for tenant ${tenant.id}:`,
              error,
            );
          },
        ),
      ]);
    });
  }

  return tenant;
}

async function populateTenantBrand(
  tenantId: string,
  slug: string,
  name: string,
  domain: string,
) {
  const result = await fetchTenantBrand(domain);
  if (result.errors.length > 0) {
    console.warn(`[Tenant] Brand fetch warnings for tenant ${tenantId}:`, {
      errors: result.errors,
    });
  }

  const [current] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!current) return;

  const existingSettings = isRecord(current.settings)
    ? current.settings
    : {};
  const existingBrandJson = isRecord(existingSettings.brandJson)
    ? existingSettings.brandJson
    : {};
  const brandJson: Record<string, unknown> = {
    ...existingBrandJson,
    id: slug,
    name: result.siteName || name,
  };

  if (result.logo) {
    brandJson.logo = {
      url: result.logo.url,
      alt: result.logo.alt,
      height: 30,
    };
  }

  if (result.themeColor) {
    brandJson.colors = {
      ...(isRecord(existingBrandJson.colors) ? existingBrandJson.colors : {}),
      primary: result.themeColor,
    };
  }

  await db
    .update(tenants)
    .set({
      settings: {
        ...existingSettings,
        brandJson,
      },
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function checkMembership(tenantId: string, userId: string) {
  const [member] = await db
    .select()
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, userId)
      )
    )
    .limit(1);
  return member ?? null;
}
