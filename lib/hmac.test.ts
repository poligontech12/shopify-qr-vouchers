import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyShopifyHmac } from "./hmac";

const secret = "test-secret";
const body = '{"hello":"world"}';
const validSig = crypto.createHmac("sha256", secret).update(body).digest("base64");

describe("verifyShopifyHmac", () => {
  it("returns true for a valid signature", () => {
    expect(verifyShopifyHmac(body, validSig, secret)).toBe(true);
  });

  it("returns false for a tampered body", () => {
    expect(verifyShopifyHmac(body + "x", validSig, secret)).toBe(false);
  });

  it("returns false for a wrong secret", () => {
    expect(verifyShopifyHmac(body, validSig, "wrong-secret")).toBe(false);
  });

  it("returns false for a malformed signature", () => {
    expect(verifyShopifyHmac(body, "not-base64!!!", secret)).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(verifyShopifyHmac(body, "", secret)).toBe(false);
  });
});
