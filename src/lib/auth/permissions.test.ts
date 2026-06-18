import { describe, it, expect } from "vitest";
import { can } from "./permissions";

describe("permission matrix", () => {
  it("Admin can create users", () => {
    expect(can({ role: "ADMIN" }, "users", "create")).toBe(true);
  });

  it("Merchandiser cannot create users", () => {
    expect(can({ role: "MERCHANDISER" }, "users", "create")).toBe(false);
  });

  it("Merchandiser can create orders", () => {
    expect(can({ role: "MERCHANDISER" }, "orders", "create")).toBe(true);
  });

  it("Accounts can approve costing", () => {
    expect(can({ role: "ACCOUNTS" }, "costing", "approve")).toBe(true);
  });

  it("Merchandiser cannot approve costing", () => {
    expect(can({ role: "MERCHANDISER" }, "costing", "approve")).toBe(false);
  });

  it("Management is view-only on orders", () => {
    expect(can({ role: "MANAGEMENT" }, "orders", "view")).toBe(true);
    expect(can({ role: "MANAGEMENT" }, "orders", "edit")).toBe(false);
  });

  it("Merchandiser has no access to the audit log", () => {
    expect(can({ role: "MERCHANDISER" }, "auditLog", "view")).toBe(false);
  });

  it("Admin can view the audit log but not delete it", () => {
    expect(can({ role: "ADMIN" }, "auditLog", "view")).toBe(true);
    expect(can({ role: "ADMIN" }, "auditLog", "delete")).toBe(false);
  });
});
