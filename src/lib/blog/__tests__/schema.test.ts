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

function isObjectType(type: unknown): boolean {
  return type === "object" || (Array.isArray(type) && type.includes("object"));
}

function assertStrictObjects(node: unknown, path: string): void {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    node.forEach((item, index) => assertStrictObjects(item, `${path}[${index}]`));
    return;
  }

  const schemaNode = node as Record<string, unknown>;
  if (isObjectType(schemaNode.type)) {
    assert.equal(
      schemaNode.additionalProperties,
      false,
      `${path} must set additionalProperties: false`
    );
  }

  for (const [key, value] of Object.entries(schemaNode)) {
    assertStrictObjects(value, `${path}.${key}`);
  }
}

function assertRequiredProperties(node: unknown, path: string): void {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    node.forEach((item, index) => assertRequiredProperties(item, `${path}[${index}]`));
    return;
  }

  const schemaNode = node as Record<string, unknown>;
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
    assertRequiredProperties(value, `${path}.${key}`);
  }
}

test("blog schemas are strict for every object node", () => {
  for (const [name, schema] of schemas) {
    assertStrictObjects(schema, name);
  }
});

test("blog schemas require every property for every object node", () => {
  for (const [name, schema] of schemas) {
    assertRequiredProperties(schema, name);
  }
});
