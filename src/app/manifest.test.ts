import { describe, it, expect } from "vitest";
import manifest from "./manifest";

describe("manifest", () => {
  it("describes an installable ABD Sourcing PWA", () => {
    const m = manifest();
    expect(m.name).toBe("ABD Sourcing");
    expect(m.short_name).toBe("ABD");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.theme_color).toBe("#d32f2f");
    expect(m.background_color).toBe("#f4f6f9");
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect((m.icons ?? []).some((i) => i.purpose === "maskable")).toBe(true);
  });
});
