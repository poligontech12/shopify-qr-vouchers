import crypto from "node:crypto";

// Shopify sends X-Shopify-Hmac-Sha256 as base64(HMAC-SHA256(secret, rawBody)).
// We must use timingSafeEqual to avoid timing attacks, and we must guard
// against length mismatches before calling it (it throws on unequal lengths).
export function verifyShopifyHmac(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}
