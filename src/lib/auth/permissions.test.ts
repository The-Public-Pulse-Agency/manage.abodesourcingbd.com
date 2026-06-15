import { describe, it, expect } from "vitest";
import { can } from "./permissions";

describe("permission matrix", () => {
  it("Admin can create users", () => {
    expect(can("ADMIN", "users", "create")).toBe(true);
  });

  it("Merchandiser cannot create users", () => {
    expect(can("MERCHANDISER", "users", "create")).toBe(false);
  });

  it("Merchandiser can create orders", () => {
    expect(can("MERCHANDISER", "orders", "create")).toBe(true);
  });

  it("Accounts can approve costing", () => {
    expect(can("ACCOUNTS", "costing", "approve")).toBe(true);
  });

  it("Merchandiser cannot approve costing", () => {
    expect(can("MERCHANDISER", "costing", "approve")).toBe(false);
  });

  it("Management is view-only on orders", () => {
    expect(can("MANAGEMENT", "orders", "view")).toBe(true);
    expect(can("MANAGEMENT", "orders", "edit")).toBe(false);
  });

  it("Merchandiser has no access to the audit log", () => {
    expect(can("MERCHANDISER", "auditLog", "view")).toBe(false);
  });

  it("Admin can view the audit log but not delete it", () => {
    expect(can("ADMIN", "auditLog", "view")).toBe(true);
    expect(can("ADMIN", "auditLog", "delete")).toBe(false);
  });
});
