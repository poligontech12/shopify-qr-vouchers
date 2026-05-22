import { describe, it, expect } from "vitest";
import { urlToQrPng } from "./qr";

describe("urlToQrPng", () => {
  it("returns a PNG buffer for a given URL", async () => {
    const buf = await urlToQrPng("https://example.com/redeem/abc123");
    expect(Buffer.isBuffer(buf)).toBe(true);
    // PNG magic bytes
    expect(buf[0]).toBe(0x89);
    expect(buf.subarray(1, 4).toString()).toBe("PNG");
    expect(buf.length).toBeGreaterThan(200);
  });

  it("produces different output for different inputs", async () => {
    const a = await urlToQrPng("https://example.com/redeem/aaa");
    const b = await urlToQrPng("https://example.com/redeem/bbb");
    expect(a.equals(b)).toBe(false);
  });
});
