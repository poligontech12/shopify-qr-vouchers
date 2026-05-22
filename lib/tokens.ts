import crypto from "node:crypto";

export type TokenParts = {
  orderId: string;
  lineItemId: string;
  unitIndex: number;
};

// HMAC output is hex to match Shopify Liquid's `hmac_sha256` filter, which
// returns lowercase hex. This means a partner can generate the exact same
// token URL in a Liquid email template that we verify on the server.
function hmacHex(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function signToken(parts: TokenParts, secret: string): string {
  const payload = `${parts.orderId}.${parts.lineItemId}.${parts.unitIndex}`;
  return `${payload}.${hmacHex(payload, secret)}`;
}

export function verifyToken(token: string, secret: string): TokenParts | null {
  if (!token) return null;
  const segments = token.split(".");
  if (segments.length !== 4) return null;

  const [orderId, lineItemId, unitIndexStr, providedSig] = segments;
  if (!orderId || !lineItemId || !unitIndexStr || !providedSig) return null;

  const payload = `${orderId}.${lineItemId}.${unitIndexStr}`;
  const expectedSig = hmacHex(payload, secret);

  if (providedSig.length !== expectedSig.length) return null;
  if (
    !crypto.timingSafeEqual(
      Buffer.from(providedSig),
      Buffer.from(expectedSig),
    )
  ) {
    return null;
  }

  const unitIndex = Number.parseInt(unitIndexStr, 10);
  // Reject NaN, decimals, zero, negatives, and overflow.
  if (
    !Number.isInteger(unitIndex) ||
    unitIndex < 1 ||
    String(unitIndex) !== unitIndexStr
  ) {
    return null;
  }

  return { orderId, lineItemId, unitIndex };
}
