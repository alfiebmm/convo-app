import { test } from "node:test";
import assert from "node:assert/strict";
import type { requireStepUp } from "../step-up";

test("requireStepUp type accepts sensitive actions only", () => {
  function typeCheck() {
    const acceptsSensitiveAction: typeof requireStepUp = async () => ({
      user: {
        id: "user-1",
        email: "admin@example.com",
        isPlatformStaff: true,
      },
      action: "billing.refund",
      issuedAt: 1,
    });
    void acceptsSensitiveAction("billing.refund");
    // @ts-expect-error tenant.view is not a sensitive action.
    void acceptsSensitiveAction("tenant.view");
  }
  void typeCheck;
  assert.equal(true, true);
});
