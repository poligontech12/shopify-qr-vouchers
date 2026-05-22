import { describe, it, expect } from "vitest";
import { parsePartnerPins, storeForPin } from "./pins";

describe("parsePartnerPins", () => {
  it("parses a simple two-store env value", () => {
    expect(parsePartnerPins("storeA:1234,storeB:5678")).toEqual({
      "1234": "storeA",
      "5678": "storeB",
    });
  });

  it("trims whitespace around entries", () => {
    expect(parsePartnerPins(" storeA : 1234 , storeB : 5678 ")).toEqual({
      "1234": "storeA",
      "5678": "storeB",
    });
  });

  it("ignores empty entries", () => {
    expect(parsePartnerPins("storeA:1234,,storeB:5678,")).toEqual({
      "1234": "storeA",
      "5678": "storeB",
    });
  });

  it("returns empty record for empty input", () => {
    expect(parsePartnerPins("")).toEqual({});
    expect(parsePartnerPins(undefined)).toEqual({});
  });

  it("skips malformed entries (no colon)", () => {
    expect(parsePartnerPins("storeA:1234,broken,storeB:5678")).toEqual({
      "1234": "storeA",
      "5678": "storeB",
    });
  });
});

describe("storeForPin", () => {
  const pins = { "1234": "storeA", "5678": "storeB" };

  it("returns store name for a matching pin", () => {
    expect(storeForPin(pins, "1234")).toBe("storeA");
    expect(storeForPin(pins, "5678")).toBe("storeB");
  });

  it("returns null for a non-matching pin", () => {
    expect(storeForPin(pins, "9999")).toBeNull();
  });

  it("returns null for empty pin", () => {
    expect(storeForPin(pins, "")).toBeNull();
  });
});
