import { describe, it, expect } from "vitest";
import { assertPermission, ForbiddenError } from "./guard";

describe("assertPermission", () => {
  it("allows a permitted action", () => {
    expect(() =>
      assertPermission({ id: "u1", role: "ADMIN" }, "users", "create"),
    ).not.toThrow();
  });

  it("throws ForbiddenError for a denied action", () => {
    expect(() =>
      assertPermission({ id: "u2", role: "MERCHANDISER" }, "users", "create"),
    ).toThrow(ForbiddenError);
  });

  it("throws when there is no user", () => {
    expect(() => assertPermission(null, "orders", "view")).toThrow(ForbiddenError);
  });
});
