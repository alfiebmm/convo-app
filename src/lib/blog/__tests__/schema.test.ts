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

function assertStrictObjects(node: unknown, path: string): void {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    node.forEach((item, index) => assertStrictObjects(item, `${path}[${index}]`));
    return;
  }

  const schemaNode = node as Record<string, unknown>;
  if (schemaNode.type === "object") {
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

test("blog schemas are strict for every object node", () => {
  for (const [name, schema] of schemas) {
    assertStrictObjects(schema, name);
  }
});
