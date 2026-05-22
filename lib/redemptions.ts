import { query } from "./db";
import type { TokenParts } from "./tokens";

export type Redemption = {
  order_id: string;
  line_item_id: string;
  unit_index: number;
  partner_store: string;
  redeemed_at: Date;
};

export async function getRedemption(
  parts: TokenParts,
): Promise<Redemption | null> {
  const { rows } = await query<Redemption>(
    `SELECT order_id, line_item_id, unit_index, partner_store, redeemed_at
     FROM redemptions
     WHERE order_id = $1 AND line_item_id = $2 AND unit_index = $3
     LIMIT 1`,
    [parts.orderId, parts.lineItemId, parts.unitIndex],
  );
  return rows[0] ?? null;
}

export type RedeemResult = "ok" | "already_used";

// Atomic mark-used. The PRIMARY KEY on (order_id, line_item_id, unit_index)
// combined with ON CONFLICT DO NOTHING means concurrent redeems on the same
// voucher can't both succeed: whichever INSERT lands first wins, the second
// sees rowCount=0.
export async function tryRedeem(
  parts: TokenParts,
  partnerStore: string,
): Promise<RedeemResult> {
  const result = await query(
    `INSERT INTO redemptions (order_id, line_item_id, unit_index, partner_store)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (order_id, line_item_id, unit_index) DO NOTHING`,
    [parts.orderId, parts.lineItemId, parts.unitIndex, partnerStore],
  );
  return result.rowCount === 1 ? "ok" : "already_used";
}
