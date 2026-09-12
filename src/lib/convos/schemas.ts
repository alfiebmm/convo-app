import { z } from "zod";

export const convoStatusSchema = z.enum(["active", "completed", "archived"]);
export const followUpStatusSchema = z.enum([
  "open",
  "in_progress",
  "waiting_on_customer",
  "resolved",
  "dismissed",
]);

export const convoSortSchema = z.enum(["lastActivityAt", "startedAt", "title"]);
export const sortDirectionSchema = z.enum(["asc", "desc"]);

export const listConvosQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: convoStatusSchema.optional(),
  followUpRequired: z.coerce.boolean().optional(),
  followUpStatus: followUpStatusSchema.optional(),
  persona: z.string().trim().min(1).max(255).optional(),
  sort: convoSortSchema.default("lastActivityAt"),
  direction: sortDirectionSchema.default("desc"),
});

export const patchConvoBodySchema = z
  .object({
    followUpStatus: followUpStatusSchema.optional(),
    assignedOwnerId: z.string().uuid().nullable().optional(),
    note: z.string().trim().min(1).max(10_000).optional(),
  })
  .refine(
    (value) =>
      value.followUpStatus !== undefined ||
      value.assignedOwnerId !== undefined ||
      value.note !== undefined,
    "Pass followUpStatus, assignedOwnerId, and/or note."
  );

export const createConvoNoteBodySchema = z.object({
  body: z.string().trim().min(1).max(10_000),
});

const dateStringSchema = z.string().datetime();

export const convoListItemSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  title: z.string().nullable(),
  topic: z.string().nullable(),
  persona: z.string().nullable(),
  status: convoStatusSchema,
  blogStatus: z.string().nullable(),
  followUpRequired: z.boolean(),
  followUpType: z.string().nullable(),
  followUpStatus: followUpStatusSchema.nullable(),
  assignedOwnerId: z.string().uuid().nullable(),
  assignedOwnerName: z.string().nullable(),
  startedAt: dateStringSchema,
  lastActivityAt: dateStringSchema,
  messageCount: z.number().int().nonnegative(),
});

export const listConvosResponseSchema = z.object({
  items: z.array(convoListItemSchema),
  pagination: z.object({
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    nextOffset: z.number().int().nonnegative().nullable(),
  }),
});

export const convoDetailResponseSchema = z.object({
  convo: convoListItemSchema.extend({
    visitorId: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()),
    completedAt: dateStringSchema.nullable(),
    summary: z.string().nullable(),
    summaryGeneratedAt: dateStringSchema.nullable(),
  }),
  transcript: z.array(
    z.object({
      id: z.string().uuid(),
      role: z.string(),
      content: z.string(),
      createdAt: dateStringSchema,
    })
  ),
  tags: z.array(z.object({ key: z.string(), value: z.unknown() })),
  capturedCustomerDetails: z
    .object({
      id: z.string().uuid(),
      displayName: z.string().nullable(),
      emailNormalised: z.string().nullable(),
      phoneNormalised: z.string().nullable(),
      preferredContactMethod: z.string().nullable(),
      attributes: z.record(z.string(), z.unknown()),
    })
    .nullable(),
  internalNotes: z.array(
    z.object({
      id: z.string().uuid(),
      bodyHtml: z.string(),
      actorId: z.string().nullable(),
      createdAt: dateStringSchema,
    })
  ),
  activityHistory: z.array(
    z.object({
      id: z.string().uuid(),
      eventType: z.string(),
      actorType: z.string(),
      actorId: z.string().nullable(),
      payload: z.record(z.string(), z.unknown()),
      createdAt: dateStringSchema,
    })
  ),
  linkedBlogArticle: z
    .object({
      id: z.string().uuid(),
      title: z.string(),
      slug: z.string(),
      status: z.string(),
      publishedAt: dateStringSchema.nullable(),
    })
    .nullable(),
});

export const mutateConvoResponseSchema = z.object({
  ok: z.literal(true),
  convo: convoListItemSchema,
});

export const createConvoNoteResponseSchema = z.object({
  ok: z.literal(true),
  note: z.object({
    id: z.string().uuid(),
    bodyHtml: z.string(),
    actorId: z.string().nullable(),
    createdAt: dateStringSchema,
  }),
});
