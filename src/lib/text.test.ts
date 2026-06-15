import { describe, it, expect } from "vitest";
import { normalizeName, slugCode } from "./text";

describe("normalizeName", () => {
  it("lowercases, trims and collapses internal whitespace", () => {
    expect(normalizeName("  LIZ/  TEI TAK ")).toBe("liz/ tei tak");
  });
  it("treats case/spacing variants as equal", () => {
    expect(normalizeName("Green Life/TTF ")).toBe(normalizeName("green life/ttf"));
  });
});

describe("slugCode", () => {
  it("builds an uppercase alnum code", () => {
    expect(slugCode("Green Life/TTF")).toBe("GREEN-LIFE-TTF");
  });
  it("strips repeated separators", () => {
    expect(slugCode("UHM   Ltd ")).toBe("UHM-LTD");
  });
});
