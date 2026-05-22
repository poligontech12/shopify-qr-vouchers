CREATE TABLE IF NOT EXISTS vouchers (
  token          TEXT PRIMARY KEY,
  order_id       TEXT NOT NULL,
  order_number   TEXT NOT NULL,
  email          TEXT NOT NULL,
  product_name   TEXT NOT NULL,
  partner_store  TEXT,
  used           BOOLEAN NOT NULL DEFAULT FALSE,
  used_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vouchers_order_id_idx ON vouchers(order_id);
