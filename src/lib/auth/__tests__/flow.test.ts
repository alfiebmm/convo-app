import { test } from "node:test";
import assert from "node:assert/strict";

import {
  decideAuthFlow,
  parseAuthFlow,
  AUTH_FLOW_COOKIE_MAX_AGE_SECONDS,
} from "../flow";

test("parseAuthFlow accepts 'login' and 'signup'", () => {
  assert.equal(parseAuthFlow("login"), "login");
  assert.equal(parseAuthFlow("signup"), "signup");
});

test("parseAuthFlow rejects anything else", () => {
  assert.equal(parseAuthFlow(null), null);
  assert.equal(parseAuthFlow(undefined), null);
  assert.equal(parseAuthFlow(""), null);
  assert.equal(parseAuthFlow("LOGIN"), null);
  assert.equal(parseAuthFlow("admin"), null);
  assert.equal(parseAuthFlow("signup; flow=login"), null);
});

test("decideAuthFlow: flow=login + existing user with tenant → allow", () => {
  const decision = decideAuthFlow({
    flow: "login",
    existingUser: true,
    hasTenantMembership: true,
  });
  assert.deepEqual(decision, { kind: "allow", reason: "login-existing" });
});

test("decideAuthFlow: flow=login + no account → deny + redirect", () => {
  const decision = decideAuthFlow({ flow: "login", existingUser: false });
  assert.equal(decision.kind, "deny");
  if (decision.kind === "deny") {
    assert.equal(decision.redirectTo, "/login?error=no_account");
    assert.equal(decision.reason, "login-no-account");
  }
});

// CON-239: tenantless existing user with no staff flag → deny.
// Otherwise we'd silently shove them into onboarding via NextAuth's
// newUser redirect, which is exactly the foot-gun CON-237 closed.
test(
  "decideAuthFlow: flow=login + existing user, no tenant, not staff → deny",
  () => {
    const decision = decideAuthFlow({
      flow: "login",
      existingUser: true,
      hasTenantMembership: false,
      isPlatformStaff: false,
    });
    assert.equal(decision.kind, "deny");
    if (decision.kind === "deny") {
      assert.equal(decision.reason, "login-no-account");
    }
  },
);

// CON-239: platform staff can log in even without a tenant membership.
// The dashboard then routes them to /platform-admin (see
// `resolveDashboardLandingRedirect`).
test(
  "decideAuthFlow: flow=login + platform staff, no tenant → allow (staff)",
  () => {
    const decision = decideAuthFlow({
      flow: "login",
      existingUser: true,
      hasTenantMembership: false,
      isPlatformStaff: true,
    });
    assert.equal(decision.kind, "allow");
    if (decision.kind === "allow") {
      assert.equal(decision.reason, "login-platform-staff");
    }
  },
);

// CON-239: platform staff who also belong to a tenant get the normal
// existing-user branch so the tenant dashboard renders by default.
test(
  "decideAuthFlow: flow=login + platform staff WITH tenant → allow (existing)",
  () => {
    const decision = decideAuthFlow({
      flow: "login",
      existingUser: true,
      hasTenantMembership: true,
      isPlatformStaff: true,
    });
    assert.deepEqual(decision, {
      kind: "allow",
      reason: "login-existing",
    });
  },
);

test("decideAuthFlow: flow=signup + new user → allow (will provision)", () => {
  const decision = decideAuthFlow({ flow: "signup", existingUser: false });
  assert.deepEqual(decision, { kind: "allow", reason: "signup-new" });
});

test("decideAuthFlow: flow=signup + existing user → bounce to welcome-back", () => {
  const decision = decideAuthFlow({ flow: "signup", existingUser: true });
  assert.equal(decision.kind, "allow-redirect");
  if (decision.kind === "allow-redirect") {
    assert.equal(decision.to, "/dashboard?welcome=back");
    assert.equal(decision.reason, "signup-existing");
  }
});

test("decideAuthFlow: missing flow cookie defaults to login (safe)", () => {
  // No cookie means we don't know what the user wanted. We default to
  // "login" because that branch will never silently provision a new
  // user/tenant row — at worst the user sees an explicit "no account"
  // error and can retry via /signup.
  const newUser = decideAuthFlow({ flow: null, existingUser: false });
  assert.equal(newUser.kind, "deny");

  const existing = decideAuthFlow({
    flow: null,
    existingUser: true,
    hasTenantMembership: true,
  });
  assert.equal(existing.kind, "allow");
});

test("AUTH_FLOW_COOKIE_MAX_AGE_SECONDS is short-lived", () => {
  // Belt-and-braces: if anyone bumps this to "forever" the intent
  // cookie could outlive a normal OAuth round-trip and re-fire on a
  // later unrelated sign-in.
  assert.ok(AUTH_FLOW_COOKIE_MAX_AGE_SECONDS <= 15 * 60);
  assert.ok(AUTH_FLOW_COOKIE_MAX_AGE_SECONDS >= 60);
});
