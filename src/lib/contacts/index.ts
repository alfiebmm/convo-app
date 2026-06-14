/**
 * Contacts data-access helpers (CON-164 / Epic B5).
 *
 * Tenant-scoped CRUD for `contacts` + `conversation_contacts`. Every
 * public function takes `tenantId` first and validates it before any DB
 * call. Lookups go through `ContactsStore`, which guarantees every
 * WHERE clause includes `tenant_id = $tenantId`.
 *
 * Identifier normalisation:
 *   - Emails are lowercased + trimmed.
 *   - Phones are NOT normalised here (no telephone library dependency).
 *     Callers should pass an E.164 string or pre-normalised value. The
 *     `phoneNormalised` column treats whatever you pass as canonical.
 *
 * NB: The `contact_identifiers` table is NOT touched in B5 — that is
 * downstream of B1 and ships in its own helper module when needed.
 */

import { assertTenantId, assertUuid } from "../cases/tenant-guard";
import {
  getDefaultContactsStore,
  type ContactRow,
  type ContactsStore,
  type ConversationContactLinkRow,
  type LinkContactInput,
  type UpsertContactInput,
} from "./store";

export type {
  ContactRow,
  ContactsStore,
  ConversationContactLinkRow,
  LinkContactInput,
  UpsertContactInput,
} from "./store";

export interface ContactHelperOptions {
  store?: ContactsStore;
}

function resolveStore(opts?: ContactHelperOptions): ContactsStore {
  return opts?.store ?? getDefaultContactsStore();
}

// ---------------------------------------------------------------------------
// Identifier normalisation (pure, exported for tests + callers)
// ---------------------------------------------------------------------------

/**
 * Normalise an email for the `email_normalised` column. Trims surrounding
 * whitespace and lowercases. Returns `null` for empty/`undefined`/`null`.
 */
export function normaliseEmail(email: string | null | undefined): string | null {
  if (email === null || email === undefined) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed === "" ? null : trimmed;
}

/**
 * Pass-through phone normaliser. Trims surrounding whitespace; does NOT
 * attempt to parse E.164. Callers responsible for canonical format.
 */
export function normalisePhone(phone: string | null | undefined): string | null {
  if (phone === null || phone === undefined) return null;
  const trimmed = phone.trim();
  return trimmed === "" ? null : trimmed;
}

// ---------------------------------------------------------------------------
// upsertContact
// ---------------------------------------------------------------------------

/**
 * Upsert a contact. Matches by email > phone; falls through to insert on
 * miss. Returns the canonical row + a `created` flag for callers that
 * need to differentiate (e.g. firing a "new contact" notification).
 *
 * @param tenantId Tenant UUID — REQUIRED.
 * @param input Contact payload. Should supply at least one of
 *   `emailNormalised` or `phoneNormalised`; otherwise the row would be
 *   anonymous and would always insert. Pre-normalise via `normaliseEmail`
 *   / `normalisePhone` if you have raw input.
 * @returns The persisted row + `created: true` if a new row was inserted.
 *
 * @throws Error when `tenantId` is missing or not a valid UUID.
 * @throws Error when neither `emailNormalised` nor `phoneNormalised` is set
 *   AND no `displayName` is supplied (defends against silent anonymous-
 *   contact creation — call sites should be explicit).
 */
export async function upsertContact(
  tenantId: string,
  input: UpsertContactInput,
  opts?: ContactHelperOptions
): Promise<{ contact: ContactRow; created: boolean }> {
  assertTenantId(tenantId);
  if (
    !input.emailNormalised &&
    !input.phoneNormalised &&
    !input.displayName
  ) {
    throw new Error(
      "upsertContact requires at least one of emailNormalised, phoneNormalised, or displayName"
    );
  }

  return resolveStore(opts).upsertContact(tenantId, input);
}

// ---------------------------------------------------------------------------
// linkContactToConversation
// ---------------------------------------------------------------------------

/**
 * Link a contact to a conversation with the given relationship label.
 * Idempotent on `(conversationId, contactId)` — re-running with a different
 * `relationship` overwrites the previous label.
 *
 * @param tenantId Tenant UUID — REQUIRED.
 * @param input Link payload. All three of `conversationId`, `contactId`,
 *   and `relationship` are required.
 * @returns The persisted link row.
 *
 * @throws Error when `tenantId`/`input.conversationId`/`input.contactId`
 *   are missing or not valid UUIDs.
 * @throws Error when `input.relationship` is empty.
 */
export async function linkContactToConversation(
  tenantId: string,
  input: LinkContactInput,
  opts?: ContactHelperOptions
): Promise<ConversationContactLinkRow> {
  assertTenantId(tenantId);
  assertUuid(input.conversationId, "conversationId");
  assertUuid(input.contactId, "contactId");
  if (!input.relationship || typeof input.relationship !== "string") {
    throw new Error("relationship is required");
  }

  return resolveStore(opts).linkContactToConversation(tenantId, input);
}

// ---------------------------------------------------------------------------
// getContactById
// ---------------------------------------------------------------------------

/**
 * Fetch a contact by id, scoped to the tenant. Returns `null` when the
 * contact does not exist OR belongs to a different tenant. Non-enumerating.
 *
 * @param tenantId Tenant UUID — REQUIRED.
 * @param contactId Contact UUID — REQUIRED.
 * @returns The contact row, or `null` if not found in this tenant.
 *
 * @throws Error when `tenantId`/`contactId` are missing or not valid UUIDs.
 */
export async function getContactById(
  tenantId: string,
  contactId: string,
  opts?: ContactHelperOptions
): Promise<ContactRow | null> {
  assertTenantId(tenantId);
  assertUuid(contactId, "contactId");

  return resolveStore(opts).findContactById(tenantId, contactId);
}
