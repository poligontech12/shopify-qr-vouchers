import crypto from "node:crypto";
import { query } from "./db";

export type Voucher = {
  token: string;
  order_id: string;
  order_number: string;
  email: string;
  product_name: string;
  partner_store: string | null;
  used: boolean;
  used_at: Date | null;
  created_at: Date;
};

export type NewVoucherInput = {
  order_id: string;
  order_number: string;
  email: string;
  product_name: string;
};

export async function orderHasVouchers(orderId: string): Promise<boolean> {
  const { rows } = await query(
    "SELECT 1 FROM vouchers WHERE order_id = $1 LIMIT 1",
    [orderId],
  );
  return rows.length > 0;
}

export async function createVouchers(
  items: NewVoucherInput[],
): Promise<string[]> {
  const tokens: string[] = [];
  for (const item of items) {
    const token = crypto.randomBytes(16).toString("hex");
    await query(
      `INSERT INTO vouchers (token, order_id, order_number, email, product_name)
       VALUES ($1, $2, $3, $4, $5)`,
      [token, item.order_id, item.order_number, item.email, item.product_name],
    );
    tokens.push(token);
  }
  return tokens;
}

export async function getByToken(token: string): Promise<Voucher | null> {
  const { rows } = await query<Voucher>(
    `SELECT token, order_id, order_number, email, product_name,
            partner_store, used, used_at, created_at
     FROM vouchers
     WHERE token = $1
     LIMIT 1`,
    [token],
  );
  return rows[0] ?? null;
}

export type RedeemResult = "ok" | "already_used_or_missing";

// Atomic mark-used. The WHERE used=false guard means concurrent scans
// can't both succeed: whichever UPDATE runs first changes the row, the
// second sees rowCount=0.
export async function redeem(
  token: string,
  partnerStore: string,
): Promise<RedeemResult> {
  const result = await query(
    `UPDATE vouchers
     SET used = TRUE, used_at = NOW(), partner_store = $1
     WHERE token = $2 AND used = FALSE`,
    [partnerStore, token],
  );
  return result.rowCount === 1 ? "ok" : "already_used_or_missing";
}
