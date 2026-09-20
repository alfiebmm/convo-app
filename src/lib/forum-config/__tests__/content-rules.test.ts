import { test } from "node:test";
import assert from "node:assert/strict";

import {
  findExcludedTopic,
  resolveContentRuleExclusions,
} from "../content-rules";

test("contentRules exclusionList is preferred over legacy exclusion_list", () => {
  const settings = {
    forumConfig: {
      exclusion_list: ["legacy topic"],
      contentRules: {
        exclusionList: ["regulated advice"],
      },
    },
  };

  assert.deepEqual(resolveContentRuleExclusions(settings), ["regulated advice"]);
  assert.equal(
    findExcludedTopic(settings, "Can you help with regulated advice?"),
    "regulated advice",
  );
  assert.equal(findExcludedTopic(settings, "legacy topic question"), null);
});

test("legacy exclusion_list remains the fallback", () => {
  const settings = {
    forumConfig: {
      exclusion_list: ["medical advice"],
    },
  };

  assert.deepEqual(resolveContentRuleExclusions(settings), ["medical advice"]);
  assert.equal(
    findExcludedTopic(settings, "I need medical advice for symptoms"),
    "medical advice",
  );
});
