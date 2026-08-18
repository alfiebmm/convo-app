import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchTenantBrand } from "@/lib/knowledge/brand-fetcher";

export type BrandSettingsTenant = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  settings: unknown;
};

export type BrandSettingsDeps = {
  getTenant: (tenantId: string) => Promise<BrandSettingsTenant | null>;
  saveTenantSettings: (
    tenantId: string,
    settings: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  uploadLogo?: (
    tenantId: string,
    file: File,
  ) => Promise<{ publicUrl: string }>;
};

const brandPayloadSchema = z.object({
  action: z.enum(["save", "refresh"]).default("save"),
  siteName: z.string().trim().min(1).max(120).optional(),
  logoUrl: z.string().url().startsWith("https://").optional(),
  logoAlt: z.string().trim().min(1).max(160).optional(),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
});

export type BrandPayload = z.infer<typeof brandPayloadSchema>;

export async function handleBrandSettingsPost(
  tenantId: string,
  body: unknown,
  deps: BrandSettingsDeps,
) {
  const parsed = brandPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const tenant = await deps.getTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (parsed.data.action === "refresh") {
    if (!tenant.domain) {
      return NextResponse.json(
        { error: "Tenant has no domain to refresh from" },
        { status: 400 },
      );
    }
    const result = await fetchTenantBrand(tenant.domain);
    return NextResponse.json({ fetched: result });
  }

  const settings = isRecord(tenant.settings) ? tenant.settings : {};
  const currentBrandJson = isRecord(settings.brandJson)
    ? settings.brandJson
    : {};
  const nextBrandJson: Record<string, unknown> = {
    ...currentBrandJson,
    id: tenant.slug,
    name: parsed.data.siteName || tenant.name,
  };

  if (parsed.data.logoUrl) {
    nextBrandJson.logo = {
      url: parsed.data.logoUrl,
      alt: parsed.data.logoAlt || parsed.data.siteName || tenant.name,
      height: 30,
    };
  }

  if (parsed.data.primaryColor) {
    nextBrandJson.colors = {
      ...(isRecord(currentBrandJson.colors) ? currentBrandJson.colors : {}),
      primary: parsed.data.primaryColor,
    };
  }

  const nextSettings = {
    ...settings,
    brandJson: nextBrandJson,
  };
  const saved = await deps.saveTenantSettings(tenantId, nextSettings);

  return NextResponse.json({
    brandJson: isRecord(saved.brandJson) ? saved.brandJson : nextBrandJson,
    settings: saved,
  });
}

export function readBrandPayloadFromFormData(formData: FormData): BrandPayload {
  return {
    action: "save",
    siteName: readFormString(formData, "siteName"),
    logoUrl: readFormString(formData, "logoUrl"),
    logoAlt: readFormString(formData, "logoAlt"),
    primaryColor: readFormString(formData, "primaryColor"),
  };
}

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
