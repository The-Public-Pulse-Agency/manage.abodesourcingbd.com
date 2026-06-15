import { describe, it, expect } from "vitest";
import { normalizeMasterData, parseBrandField, parseStyleName, type RawRow } from "./normalize";

describe("parseBrandField", () => {
  it("splits 'Ralawise-TRIDRI' into buyer + brand", () => {
    expect(parseBrandField("Ralawise-TRIDRI")).toEqual({ buyer: "Ralawise", brand: "TRIDRI" });
  });
  it("treats RalaTeam as the Ralawise buyer", () => {
    expect(parseBrandField("RalaTeam-AQ")).toEqual({ buyer: "Ralawise", brand: "AQ" });
  });
  it("handles 'Premier-UK' and 'TD-USA'", () => {
    expect(parseBrandField("Premier-UK")).toEqual({ buyer: "Premier", brand: "Premier" });
    expect(parseBrandField("TD-USA")).toEqual({ buyer: "TD", brand: "TD" });
  });
});

describe("parseStyleName", () => {
  it("extracts the style code prefix", () => {
    expect(parseStyleName("TR010-Mens Performance T Solid XS-2XL").code).toBe("TR010");
    expect(parseStyleName("AQ010  Mens SS CTN Polo (3XL-6XL)").code).toBe("AQ010");
  });
  it("falls back to the whole string when no code prefix", () => {
    expect(parseStyleName("Fusion Polo ( Two Colour )").code).toBe("Fusion Polo ( Two Colour )");
  });
});

describe("normalizeMasterData", () => {
  it("dedupes factories that differ only by case/spacing", () => {
    const rows: RawRow[] = [
      { factory: "LIZ/ TEI TAK", brand: "Ralawise-TRIDRI", styleName: "TR010-Mens Tee" },
      { factory: "Liz/ Tei Tak ", brand: "RalaTeam-TRIDRI", styleName: "TR010-Mens Tee" },
    ];
    const out = normalizeMasterData(rows);
    expect(out.factories).toHaveLength(1);
    expect(out.buyers).toHaveLength(1); // Ralawise (both channels)
    expect(out.brands).toHaveLength(1); // TRIDRI under Ralawise
    expect(out.styles).toHaveLength(1); // TR010 under TRIDRI
  });
});
