import { randomUUID } from "node:crypto";
import { requirePlatformStaff } from "@/lib/platform-admin/access";
import { getPlatformAdminClient } from "@/lib/platform-admin/supabase";

export const sensitiveAuditActions = [
  "impersonation.start",
  "billing.refund",
  "billing.credit",
  "billing.change_plan",
  "billing.cancel",
  "tenant.suspend",
  "tenant.soft_delete",
  "user.force_reauth",
  "user.soft_delete",
  "tenant.pii_reveal",
  "tenant.settings_edit",
] as const;

export const nonSensitiveAuditActions = [
  "tenant.view",
  "audit.export",
  "audit.view",
  "impersonation.end",
  "billing.view",
  "tenant.activity.view",
  "user.view",
] as const;

export type SensitiveAction = (typeof sensitiveAuditActions)[number];
export type NonSensitiveAction = (typeof nonSensitiveAuditActions)[number];
export type AuditAction = SensitiveAction | NonSensitiveAction;
export type AuditStatus = "intent" | "outcome:success" | "outcome:error";

type AuditTarget = { type: string; id: string };

type AuditLogBaseInput<T> = {
  action: AuditAction;
  target: AuditTarget;
  before?: unknown;
  correlationId?: string;
  idempotencyKey?: string;
  supportContext?: string;
  metadata?: Record<string, unknown>;
  resultMetadata?: (value: T) => Record<string, unknown>;
  fn: () => Promise<T>;
};

type SensitiveAuditLogInput<T> = Omit<AuditLogBaseInput<T>, "action"> & {
  action: SensitiveAction;
  reason: string;
};

type NonSensitiveAuditLogInput<T> = AuditLogBaseInput<T> & {
  action: NonSensitiveAction;
  reason?: string;
};

type ExternalActionBaseInput<T> = Omit<AuditLogBaseInput<T>, "fn"> & {
  externalCall: () => Promise<unknown>;
  recordOutcome: (externalResult: unknown) => Promise<T>;
};

type SensitiveExternalActionInput<T> = Omit<ExternalActionBaseInput<T>, "action"> & {
  action: SensitiveAction;
  reason: string;
};

type NonSensitiveExternalActionInput<T> = ExternalActionBaseInput<T> & {
  action: NonSensitiveAction;
  reason?: string;
};

export type AuditLogInput<T> =
  | SensitiveAuditLogInput<T>
  | NonSensitiveAuditLogInput<T>;

export type AuditLogResult<T> =
  | { ok: true; value: T; correlationId: string }
  | { ok: false; error: Error; correlationId: string };

export type AuditRowInsert = {
  actor_user_id: string;
  actor_email: string;
  actor_ip: string | null;
  action: AuditAction;
  target_type: string;
  target_id: string;
  status: AuditStatus;
  before_state: unknown | null;
  after_state: unknown | null;
  metadata: Record<string, unknown> | null;
  reason: string | null;
  support_context: string | null;
  correlation_id: string;
  idempotency_key: string | null;
};

export type AuditRow = AuditRowInsert & {
  id: string;
  created_at: string;
};

type AuditActor = {
  id: string;
  email: string;
};

type AuditRowInputLike = {
  action: AuditAction;
  target: AuditTarget;
  idempotencyKey?: string;
  reason?: string;
  supportContext?: string;
};

export type AuditStore = {
  insert(row: AuditRowInsert): Promise<void>;
  findSuccessfulOutcome(input: {
    actorUserId: string;
    action: AuditAction;
    targetId: string;
    idempotencyKey: string;
  }): Promise<Pick<AuditRow, "after_state" | "metadata" | "correlation_id"> | null>;
};

type AuditDeps = {
  getActor: () => Promise<AuditActor>;
  store: AuditStore;
  now?: () => Date;
};

export function requireReason(action: SensitiveAction) {
  return (reason: string, supportContext?: string) => ({
    action,
    reason,
    supportContext,
  });
}

export function isSensitiveAction(action: AuditAction): action is SensitiveAction {
  return (sensitiveAuditActions as readonly string[]).includes(action);
}

function toError(err: unknown) {
  return err instanceof Error ? err : new Error(String(err));
}

function serialiseValue(value: unknown) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

function resultSummary(value: unknown) {
  if (value === null || value === undefined) return { type: String(value) };
  if (Array.isArray(value)) return { type: "array", length: value.length };
  if (typeof value === "object") {
    return { type: "object", keys: Object.keys(value as Record<string, unknown>) };
  }
  return { type: typeof value, value };
}

async function getDefaultActor(): Promise<AuditActor> {
  const { user } = await requirePlatformStaff();
  if (!user.email) throw new Error("Platform admin actor email is missing");
  return { id: user.id, email: user.email };
}

export async function getAdminAuditLogClient() {
  const client = await getPlatformAdminClient();
  return client.from("admin_audit_log");
}

async function getDefaultStore(): Promise<AuditStore> {
  const table = await getAdminAuditLogClient();
  return {
    async insert(row) {
      const { error } = await table.insert(row);
      if (error) throw error;
    },
    async findSuccessfulOutcome({
      actorUserId,
      action,
      targetId,
      idempotencyKey,
    }) {
      const { data, error } = await table
        .select("after_state,metadata,correlation_id")
        .eq("actor_user_id", actorUserId)
        .eq("action", action)
        .eq("target_id", targetId)
        .eq("idempotency_key", idempotencyKey)
        .eq("status", "outcome:success")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Pick<
        AuditRow,
        "after_state" | "metadata" | "correlation_id"
      > | null;
    },
  };
}

async function resolveDeps(deps?: Partial<AuditDeps>): Promise<AuditDeps> {
  return {
    getActor: deps?.getActor ?? getDefaultActor,
    store: deps?.store ?? (await getDefaultStore()),
    now: deps?.now,
  };
}

function buildRow({
  actor,
  input,
  status,
  correlationId,
  before,
  after,
  metadata,
}: {
  actor: AuditActor;
  input: AuditRowInputLike;
  status: AuditStatus;
  correlationId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown> | null;
}): AuditRowInsert {
  if (isSensitiveAction(input.action) && !input.reason) {
    throw new Error(`Audit reason is required for ${input.action}`);
  }

  return {
    actor_user_id: actor.id,
    actor_email: actor.email,
    actor_ip: null,
    action: input.action,
    target_type: input.target.type,
    target_id: input.target.id,
    status,
    before_state: serialiseValue(before),
    after_state: serialiseValue(after),
    metadata: metadata ?? null,
    reason: "reason" in input ? input.reason ?? null : null,
    support_context: input.supportContext ?? null,
    correlation_id: correlationId,
    idempotency_key: input.idempotencyKey ?? null,
  };
}

export function withAuditLog<T>(
  input: SensitiveAuditLogInput<T>,
  deps?: Partial<AuditDeps>,
): Promise<AuditLogResult<T>>;
export function withAuditLog<T>(
  input: NonSensitiveAuditLogInput<T>,
  deps?: Partial<AuditDeps>,
): Promise<AuditLogResult<T>>;
export async function withAuditLog<T>(
  input: AuditLogInput<T>,
  deps?: Partial<AuditDeps>,
): Promise<AuditLogResult<T>> {
  return runAuditLog(input, deps);
}

async function runAuditLog<T>(
  input: AuditLogInput<T>,
  deps?: Partial<AuditDeps>,
): Promise<AuditLogResult<T>> {
  const resolved = await resolveDeps(deps);
  const actor = await resolved.getActor();
  const correlationId = input.correlationId ?? randomUUID();

  if (input.idempotencyKey) {
    const replay = await resolved.store.findSuccessfulOutcome({
      actorUserId: actor.id,
      action: input.action,
      targetId: input.target.id,
      idempotencyKey: input.idempotencyKey,
    });
    if (replay) {
      await resolved.store.insert(
        buildRow({
          actor,
          input,
          status: "outcome:success",
          correlationId,
          after: replay.after_state,
          metadata: {
            replay: true,
            replayed_correlation_id: replay.correlation_id,
          },
        }),
      );
      return {
        ok: true,
        value: replay.after_state as T,
        correlationId,
      };
    }
  }

  await resolved.store.insert(
    buildRow({
      actor,
      input,
      status: "intent",
      correlationId,
      before: input.before ?? null,
      metadata: input.metadata ?? null,
    }),
  );

  try {
    const value = await input.fn();
    await resolved.store.insert(
      buildRow({
        actor,
        input,
        status: "outcome:success",
        correlationId,
        after: value,
        metadata: {
          ...(input.metadata ?? {}),
          ...(input.resultMetadata?.(value) ?? {}),
          result_summary: resultSummary(value),
        },
      }),
    );
    return { ok: true, value, correlationId };
  } catch (err) {
    const error = toError(err);
    await resolved.store.insert(
      buildRow({
        actor,
        input,
        status: "outcome:error",
        correlationId,
        metadata: { error: error.message, stack: error.stack },
      }),
    );
    return { ok: false, error, correlationId };
  }
}

export function withExternalActionLog<T>(
  input: SensitiveExternalActionInput<T>,
  deps?: Partial<AuditDeps>,
): Promise<AuditLogResult<T>>;
export function withExternalActionLog<T>(
  input: NonSensitiveExternalActionInput<T>,
  deps?: Partial<AuditDeps>,
): Promise<AuditLogResult<T>>;
export async function withExternalActionLog<T>(
  input: SensitiveExternalActionInput<T> | NonSensitiveExternalActionInput<T>,
  deps?: Partial<AuditDeps>,
): Promise<AuditLogResult<T>> {
  return runAuditLog(
    {
      ...input,
      fn: async () => {
        const externalResult = await input.externalCall();
        return input.recordOutcome(externalResult);
      },
    } as AuditLogInput<T>,
    deps,
  );
}
