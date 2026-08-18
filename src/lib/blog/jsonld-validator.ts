import {
  jsonLdSchemaSpec,
  supportedSchemaTypes,
  type SchemaType,
  type TypeCheck,
} from "./jsonld-spec";

export type SchemaIssue = {
  path: string;
  severity: "error" | "warning";
  message: string;
  field?: string;
};

export type JsonLdValidationResult = {
  ok: boolean;
  issues: SchemaIssue[];
};

type JsonLdObject = Record<string, unknown>;

const supportedSchemaTypeSet = new Set<string>(supportedSchemaTypes);
const nestedSchemaTypes = new Set(["Question", "Answer", "HowToStep", "ListItem"]);

export function validateJsonLd(jsonLd: object | object[]): JsonLdValidationResult {
  const issues: SchemaIssue[] = [];

  if (Array.isArray(jsonLd)) {
    jsonLd.forEach((node, index) => validateNode(node, `[${index}]`, issues, true, true));
  } else {
    validateNode(jsonLd, "", issues, true, true);
  }

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues,
  };
}

function validateNode(
  value: unknown,
  basePath: string,
  issues: SchemaIssue[],
  requireType: boolean,
  requireSupportedFields: boolean
): void {
  if (!isRecord(value)) {
    issues.push({
      path: basePath || "$",
      severity: "error",
      message: "JSON-LD node must be an object",
    });
    return;
  }

  const graph = value["@graph"];
  if (Array.isArray(graph)) {
    graph.forEach((node, index) =>
      validateNode(node, joinPath(basePath, `@graph[${index}]`), issues, true, true)
    );
  }

  const typeValue = value["@type"];
  if (typeValue === undefined) {
    if (requireType && !Array.isArray(graph)) {
      issues.push({
        path: joinPath(basePath, "@type"),
        severity: "error",
        message: "Required field missing",
        field: "@type",
      });
    }
    validateNestedNodes(value, basePath, issues);
    return;
  }

  const types = normaliseTypeList(typeValue);
  if (types.length === 0) {
    issues.push({
      path: joinPath(basePath, "@type"),
      severity: "error",
      message: "Field must be a non-empty string or array of strings",
      field: "@type",
    });
    validateNestedNodes(value, basePath, issues);
    return;
  }

  const checkedNestedFields = new Set<string>();

  for (const type of types) {
    if (supportedSchemaTypeSet.has(type)) {
      for (const fieldPath of Object.keys(jsonLdSchemaSpec[type as SchemaType].typeChecks)) {
        checkedNestedFields.add(fieldPath.split(".")[0] ?? fieldPath);
      }

      validateSupportedNode(
        value,
        type as SchemaType,
        basePath,
        issues,
        requireSupportedFields
      );
      continue;
    }

    if (!nestedSchemaTypes.has(type)) {
      issues.push({
        path: joinPath(basePath, "@type"),
        severity: "error",
        message: `Unknown schema type: ${type}`,
        field: "@type",
      });
    }
  }

  validateNestedNodes(value, basePath, issues, checkedNestedFields);
}

function validateSupportedNode(
  node: JsonLdObject,
  schemaType: SchemaType,
  basePath: string,
  issues: SchemaIssue[],
  requireSupportedFields: boolean
): void {
  const spec = jsonLdSchemaSpec[schemaType];

  if (requireSupportedFields) {
    for (const fieldPath of spec.required) {
      if (pathValues(node, fieldPath).every(isMissing)) {
        issues.push({
          path: schemaPath(basePath, schemaType, fieldPath),
          severity: "error",
          message: "Required field missing",
          field: fieldPath,
        });
      }
    }
  }

  for (const [fieldPath, check] of Object.entries(spec.typeChecks)) {
    for (const value of pathValues(node, fieldPath)) {
      if (isMissing(value)) continue;

      const message = validateType(value, check);
      if (message) {
        issues.push({
          path: schemaPath(basePath, schemaType, fieldPath),
          severity: "error",
          message,
          field: fieldPath,
        });
      }
    }
  }
}

function validateNestedNodes(
  node: JsonLdObject,
  basePath: string,
  issues: SchemaIssue[],
  checkedNestedFields = new Set<string>()
): void {
  for (const [field, value] of Object.entries(node)) {
    if (field === "@graph") continue;
    if (checkedNestedFields.has(field)) continue;

    const path = joinPath(basePath, field);
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (isRecord(item) && item["@type"] !== undefined) {
          validateNode(item, `${path}[${index}]`, issues, false, false);
        }
      });
      continue;
    }

    if (isRecord(value) && value["@type"] !== undefined) {
      validateNode(value, path, issues, false, false);
    }
  }
}

function validateType(value: unknown, check: TypeCheck): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = validateType(item, check);
      if (message) return message;
    }
    return null;
  }

  switch (check) {
    case "string":
      return typeof value === "string" ? null : "Field must be a string";
    case "nonEmptyString":
      return typeof value === "string" && value.trim().length > 0
        ? null
        : "Field must be a non-empty string";
    case "isoDate":
      return isIsoDate(value) ? null : "Field must be an ISO-8601 date";
    case "httpsUrl":
      return isHttpsUrl(value) ? null : "Field must be an absolute HTTPS URL";
    case "image":
      return isImage(value) ? null : "Field must be an ImageObject or absolute HTTPS URL";
    case "personOrOrganization":
      return isTypedObject(value, ["Person", "Organization"]) || isRecord(value)
        ? null
        : "Field must be a Person or Organization object";
    case "thingOrUrl":
      return isRecord(value) || isHttpsUrl(value)
        ? null
        : "Field must be an object or absolute HTTPS URL";
    case "question":
      return isTypedObject(value, ["Question"]) ? null : "Field must be a Question object";
    case "answer":
      return isTypedObject(value, ["Answer"]) ? null : "Field must be an Answer object";
    case "howToStep":
      return isHowToStep(value) ? null : "Field must be a HowToStep object or text";
  }
}

function pathValues(node: JsonLdObject, fieldPath: string): unknown[] {
  const parts = fieldPath.split(".");
  let values: unknown[] = [node];

  for (const part of parts) {
    values = values.flatMap((value) => {
      if (Array.isArray(value)) {
        return value.flatMap((item) => readPart(item, part));
      }

      return readPart(value, part);
    });
  }

  return values;
}

function readPart(value: unknown, part: string): unknown[] {
  if (!isRecord(value) || !(part in value)) return [undefined];
  return [value[part]];
}

function normaliseTypeList(typeValue: unknown): string[] {
  if (typeof typeValue === "string") {
    const trimmed = typeValue.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(typeValue) && typeValue.every((item) => typeof item === "string")) {
    return typeValue.map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function isRecord(value: unknown): value is JsonLdObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0 || value.every(isMissing);
  return false;
}

function isIsoDate(value: unknown): boolean {
  if (typeof value !== "string" || value.trim().length === 0) return false;

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;

  return /^\d{4}-\d{2}-\d{2}(?:[T ].+)?$/.test(value);
}

function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isImage(value: unknown): boolean {
  if (isHttpsUrl(value)) return true;
  if (!isRecord(value)) return false;

  const typeValue = value["@type"];
  if (typeValue !== undefined && !normaliseTypeList(typeValue).includes("ImageObject")) {
    return false;
  }

  const url = value.url ?? value.contentUrl;
  return isHttpsUrl(url);
}

function isTypedObject(value: unknown, allowedTypes: string[]): boolean {
  if (!isRecord(value)) return false;
  const types = normaliseTypeList(value["@type"]);
  return types.some((type) => allowedTypes.includes(type));
}

function isHowToStep(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (!isRecord(value)) return false;

  const types = normaliseTypeList(value["@type"]);
  if (types.length > 0 && !types.some((type) => type === "HowToStep" || type === "ListItem")) {
    return false;
  }

  return !isMissing(value.name) || !isMissing(value.text) || !isMissing(value.item);
}

function schemaPath(basePath: string, schemaType: SchemaType, fieldPath: string): string {
  const prefix = basePath ? `${basePath}.${schemaType}` : schemaType;
  return `${prefix}.${fieldPath}`;
}

function joinPath(basePath: string, field: string): string {
  return basePath ? `${basePath}.${field}` : field;
}
