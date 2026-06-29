const REDACTED = "[redacted]";
const REDACTED_KEYS = new Set(["email", "phone"]);

export function redactWebhookPayload(
  payload: Record<string, unknown>,
  options: { canRevealPii: boolean },
): Record<string, unknown> {
  if (options.canRevealPii) return payload;
  return redactValue(payload, []) as Record<string, unknown>;
}

function redactValue(value: unknown, path: string[]): unknown {
  const key = path.at(-1) ?? null;
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, path));
  }

  if (!value || typeof value !== "object") {
    return shouldRedactValue(path, key) ? REDACTED : value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
      childKey,
      redactValue(childValue, [...path, childKey]),
    ]),
  );
}

function shouldRedactValue(path: string[], key: string | null): boolean {
  if (!key) return false;
  const normalisedKey = key.toLowerCase();
  return (
    REDACTED_KEYS.has(normalisedKey) ||
    (normalisedKey === "value" &&
      path.some((segment) => segment.toLowerCase() === "contact_identifiers"))
  );
}
