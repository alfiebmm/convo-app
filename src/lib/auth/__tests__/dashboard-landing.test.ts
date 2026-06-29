import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveDashboardLandingRedirect } from "../dashboard-landing";

test("hasTenant: returns /dashboard (no-op)", () => {
  assert.equal(
    resolveDashboardLandingRedirect({
      hasTenant: true,
      isPlatformStaff: false,
    }),
    "/dashboard",
  );
  assert.equal(
    resolveDashboardLandingRedirect({
      hasTenant: true,
      isPlatformStaff: true,
    }),
    "/dashboard",
  );
});

test("no tenant + platform staff -> /platform-admin", () => {
  assert.equal(
    resolveDashboardLandingRedirect({
      hasTenant: false,
      isPlatformStaff: true,
    }),
    "/platform-admin",
  );
});

test("no tenant + not staff -> /onboarding", () => {
  assert.equal(
    resolveDashboardLandingRedirect({
      hasTenant: false,
      isPlatformStaff: false,
    }),
    "/onboarding",
  );
});
