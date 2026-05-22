import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { signToken, verifyToken } from "./tokens";

const secret = "test-secret";

describe("signToken", () => {
  it("produces a token shaped {orderId}.{lineItemId}.{unitIndex}.{hex64}", () => {
    const token = signToken(
      { orderId: "1001", lineItemId: "987", unitIndex: 1 },
      secret,
    );
    const parts = token.split(".");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("1001");
    expect(parts[1]).toBe("987");
    expect(parts[2]).toBe("1");
    expect(parts[3]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces the same hex HMAC Shopify Liquid's `hmac_sha256` filter would produce", () => {
    // Compatibility check: Liquid's hmac_sha256 returns lowercase hex.
    const payload = "1001.987.1";
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    const token = signToken(
      { orderId: "1001", lineItemId: "987", unitIndex: 1 },
      secret,
    );
    expect(token).toBe(`${payload}.${expected}`);
  });

  it("produces different tokens for different unit indices", () => {
    const a = signToken({ orderId: "1", lineItemId: "2", unitIndex: 1 }, secret);
    const b = signToken({ orderId: "1", lineItemId: "2", unitIndex: 2 }, secret);
    expect(a).not.toBe(b);
  });
});

describe("verifyToken", () => {
  it("returns the parts for a freshly-signed token", () => {
    const parts = { orderId: "1001", lineItemId: "987", unitIndex: 3 };
    const token = signToken(parts, secret);
    expect(verifyToken(token, secret)).toEqual(parts);
  });

  it("returns null for a tampered signature", () => {
    const token = signToken({ orderId: "1", lineItemId: "2", unitIndex: 1 }, secret);
    const tampered = token.slice(0, -2) + "00";
    expect(verifyToken(tampered, secret)).toBeNull();
  });

  it("returns null for a tampered payload (different order id)", () => {
    const token = signToken({ orderId: "1", lineItemId: "2", unitIndex: 1 }, secret);
    const parts = token.split(".");
    const tampered = ["999", parts[1], parts[2], parts[3]].join(".");
    expect(verifyToken(tampered, secret)).toBeNull();
  });

  it("returns null when signed with a different secret", () => {
    const token = signToken({ orderId: "1", lineItemId: "2", unitIndex: 1 }, secret);
    expect(verifyToken(token, "different-secret")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(verifyToken("", secret)).toBeNull();
    expect(verifyToken("not-a-token", secret)).toBeNull();
    expect(verifyToken("a.b.c", secret)).toBeNull();
    expect(verifyToken("a.b.c.d.e", secret)).toBeNull();
  });

  it("returns null for a non-numeric unit index", () => {
    // Sign a malformed payload to get a valid HMAC, then test rejection
    const payload = "1.2.notanumber";
    const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    expect(verifyToken(`${payload}.${sig}`, secret)).toBeNull();
  });

  it("returns null for zero or negative unit index", () => {
    const payload = "1.2.0";
    const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    expect(verifyToken(`${payload}.${sig}`, secret)).toBeNull();
  });
});
