import assert from "node:assert/strict";
import { test } from "node:test";

import brandSchema from "../schemas/brand.schema.json";
import postSchema from "../schemas/post.schema.json";
import brandTemplateSchema from "../template-pack/brand.schema.json";
import postTemplateSchema from "../template-pack/post.schema.json";

const schemas = [
  ["schemas/post.schema.json", postSchema],
  ["schemas/brand.schema.json", brandSchema],
  ["template-pack/post.schema.json", postTemplateSchema],
  ["template-pack/brand.schema.json", brandTemplateSchema],
] as const;

const disallowedKeywords = new Set([
  "oneOf",
  "pattern",
  "format",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minItems",
  "maxItems",
  "uniqueItems",
  "prefixItems",
  "contains",
  "patternProperties",
  "unevaluatedProperties",
  "propertyNames",
  "not",
  "allOf",
  "if",
  "then",
  "else",
  "dependentRequired",
  "dependentSchemas",
  "contentEncoding",
  "contentMediaType",
]);

function isObjectType(type: unknown): boolean {
  return type === "object" || (Array.isArray(type) && type.includes("object"));
}

function assertOpenAiStrictMode(node: unknown, path: string, objectDepth = 0): void {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    node.forEach((item, index) =>
      assertOpenAiStrictMode(item, `${path}[${index}]`, objectDepth)
    );
    return;
  }

  const schemaNode = node as Record<string, unknown>;
  for (const key of Object.keys(schemaNode)) {
    assert.ok(
      !disallowedKeywords.has(key),
      `${path} must not use OpenAI strict-mode keyword ${key}`
    );
  }

  const nextObjectDepth = isObjectType(schemaNode.type)
    ? objectDepth + 1
    : objectDepth;
  assert.ok(
    nextObjectDepth <= 5,
    `${path} exceeds OpenAI strict-mode maximum object depth of 5`
  );

  if (isObjectType(schemaNode.type)) {
    assert.equal(
      schemaNode.additionalProperties,
      false,
      `${path} must set additionalProperties: false`
    );
    assert.ok(!("oneOf" in schemaNode), `${path} object must not use oneOf`);
    assert.ok(!("allOf" in schemaNode), `${path} object must not use allOf`);
    assert.ok(!("not" in schemaNode), `${path} object must not use not`);
  }

  if (isObjectType(schemaNode.type) && schemaNode.properties) {
    assert.ok(
      schemaNode.properties && typeof schemaNode.properties === "object",
      `${path} must define properties`
    );
    const propertyKeys = Object.keys(schemaNode.properties);
    assert.ok(Array.isArray(schemaNode.required), `${path} must define required`);
    assert.equal(
      schemaNode.required.length,
      propertyKeys.length,
      `${path} required must include every property`
    );

    for (const key of propertyKeys) {
      assert.ok(
        schemaNode.required.includes(key),
        `${path} required must include ${key}`
      );
    }
  }

  for (const [key, value] of Object.entries(schemaNode)) {
    assertOpenAiStrictMode(value, `${path}.${key}`, nextObjectDepth);
  }
}

test("blog schemas only use OpenAI strict-mode compatible keywords", () => {
  for (const [name, schema] of schemas) {
    assertOpenAiStrictMode(schema, name);
  }
});
