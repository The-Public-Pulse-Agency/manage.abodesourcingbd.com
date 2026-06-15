import { describe, it, expect } from "vitest";
import { isAuthorized } from "./cron-auth";

describe("isAuthorized", () => {
  it("fails closed when no secret is configured", () => {
    expect(isAuthorized("Bearer anything", undefined)).toBe(false);
    expect(isAuthorized("Bearer anything", "")).toBe(false);
  });

  it("rejects a missing or wrong bearer", () => {
    expect(isAuthorized(null, "s3cret")).toBe(false);
    expect(isAuthorized("Bearer wrong", "s3cret")).toBe(false);
    expect(isAuthorized("s3cret", "s3cret")).toBe(false); // missing "Bearer "
  });

  it("accepts the exact bearer", () => {
    expect(isAuthorized("Bearer s3cret", "s3cret")).toBe(true);
  });
});
