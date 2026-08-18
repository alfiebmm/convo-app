import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getActiveTenantIdForUser } from "@/lib/auth-context";
import { withApiErrorLogging } from "@/lib/errors/wrap";
import { getSupabaseClient } from "@/lib/supabase-client";
import {
  handleBrandSettingsPost,
  readBrandPayloadFromFormData,
  type BrandSettingsDeps,
} from "./handler";

const BUCKET_NAME = "tenant-brand-assets";
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
]);

function buildDeps(): BrandSettingsDeps {
  return {
    getTenant: async (tenantId) => {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      return tenant ?? null;
    },
    saveTenantSettings: async (tenantId, settings) => {
      const [updated] = await db
        .update(tenants)
        .set({ settings, updatedAt: new Date() })
        .where(eq(tenants.id, tenantId))
        .returning();
      return (updated.settings ?? {}) as Record<string, unknown>;
    },
    uploadLogo: uploadLogoFile,
  };
}

async function postImpl(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = await getActiveTenantIdForUser(session.user.id);
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 404 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const body = readBrandPayloadFromFormData(formData);
    const file = formData.get("logoFile");
    if (file instanceof File && file.size > 0) {
      try {
        const uploaded = await uploadLogoFile(tenantId, file);
        body.logoUrl = uploaded.publicUrl;
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error ? error.message : "Logo upload failed",
          },
          { status: 400 },
        );
      }
    }
    return handleBrandSettingsPost(tenantId, body, buildDeps());
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  return handleBrandSettingsPost(tenantId, body, buildDeps());
}

async function uploadLogoFile(tenantId: string, file: File) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Logo image must be PNG, JPEG, SVG, or WebP");
  }

  const supabase = getSupabaseClient();
  const extension = extensionForFile(file);
  const path = `${tenantId}/logo.${extension}`;
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return { publicUrl: data.publicUrl };
}

function extensionForFile(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/svg+xml") return "svg";
  if (file.type === "image/webp") return "webp";
  const fromName = file.name.split(".").pop()?.toLowerCase();
  return fromName || "png";
}

export const POST = withApiErrorLogging(postImpl, {
  route: "/api/settings/brand",
});
