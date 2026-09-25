// @vitest-environment node
import { describe, expect, it } from "vitest";

import { PUBLIC_ROUTE_PATHS } from "./public-routes.js";

describe("public routes allowlist", () => {
  it("lists the unauthenticated duplicate drawing endpoint", () => {
    expect(PUBLIC_ROUTE_PATHS).toContain("POST /drawings/:id/duplicate");
  });
});
