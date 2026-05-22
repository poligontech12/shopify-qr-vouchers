-- Replaces the old `vouchers` table. The snippet-based architecture no longer
-- pre-creates vouchers on order paid; tokens are HMAC-signed and self-contained.
-- We only need to persist the fact that a (order, line item, unit) has been
-- redeemed, plus by whom and when.

DROP TABLE IF EXISTS vouchers;

CREATE TABLE IF NOT EXISTS redemptions (
  order_id       TEXT NOT NULL,
  line_item_id   TEXT NOT NULL,
  unit_index     INTEGER NOT NULL,
  partner_store  TEXT NOT NULL,
  redeemed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (order_id, line_item_id, unit_index)
);
