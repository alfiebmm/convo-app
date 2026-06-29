"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getCurrentTenant } from "@/lib/auth-context";
import { assertTenantId } from "@/lib/cases/tenant-guard";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { forumConfigSchema } from "@/lib/forum-config/schema";

import {
  buildForumConfigFromQuickSetup,
  quickSetupInputSchema,
} from "./quick-setup";

const FOLLOW_UP_PATH = "/dashboard/settings/forum-config";

export type SaveQuickSetupResult =
  | { ok: true }
  | { ok: false; error: string; issues?: { path: string; message: string }[] };

export async function saveQuickSetup(
  input: unknown,
): Promise<SaveQuickSetupResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return { ok: false, error: "Tenant not found" };
  }
  assertTenantId(tenant.id);

  const parsedInput = quickSetupInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return validationError(parsedInput.error);
  }

  const [row] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenant.id))
    .limit(1);

  if (!row) {
    return { ok: false, error: "Tenant not found" };
  }

  const settings = (row.settings ?? {}) as Record<string, unknown>;
  const currentForumConfig = (settings.forumConfig ?? {}) as Record<
    string,
    unknown
  >;

  let nextForumConfig;
  try {
    nextForumConfig = forumConfigSchema.parse(
      buildForumConfigFromQuickSetup(parsedInput.data, currentForumConfig),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationError(error);
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Validation failed",
    };
  }

  await db
    .update(tenants)
    .set({
      settings: {
        ...settings,
        forumConfig: nextForumConfig,
      },
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenant.id));

  revalidatePath(FOLLOW_UP_PATH);
  return { ok: true };
}

function validationError(error: z.ZodError): SaveQuickSetupResult {
  return {
    ok: false,
    error: "Validation failed",
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
