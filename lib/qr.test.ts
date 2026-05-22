import { describe, it, expect } from "vitest";
import { tokenToDataUrl } from "./qr";

describe("tokenToDataUrl", () => {
  it("returns a PNG data URL for a given URL", async () => {
    const url = await tokenToDataUrl("https://example.com/redeem/abc123");
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    // Base64 payload should be non-trivial in size
    expect(url.length).toBeGreaterThan(200);
  });

  it("produces different output for different inputs", async () => {
    const a = await tokenToDataUrl("https://example.com/redeem/aaa");
    const b = await tokenToDataUrl("https://example.com/redeem/bbb");
    expect(a).not.toBe(b);
  });
});
