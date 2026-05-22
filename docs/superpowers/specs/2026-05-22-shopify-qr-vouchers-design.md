# Shopify Single-Use QR Voucher System — Design

**Date:** 2026-05-22
**Status:** Approved for implementation

## Purpose

Bridge an online Shopify purchase to in-person redemption at a partner store. A
customer buys a product, receives one QR code per purchased unit by email, and
brings the QR to a partner store where staff scan it, enter their store PIN, and
mark the voucher as redeemed. Each QR redeems exactly once.

## Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind (default Next.js setup, no extra UI library)
- **Hosting:** Vercel
- **Database:** Vercel Postgres (`@vercel/postgres`)
- **Email:** Resend (`resend` SDK), QR images embedded inline as base64 data URLs
- **QR generation:** `qrcode` npm package (returns data URL)

## File layout

```
app/
  api/
    shopify-webhook/route.ts   # HMAC verify, parse order, create vouchers, send email
    redeem/[token]/route.ts    # PIN check + atomic mark-used
  redeem/[token]/page.tsx      # Server-rendered status page (invalid/used/valid)
  globals.css                  # Tailwind directives
  layout.tsx                   # Minimal root layout
lib/
  db.ts          # Tiny wrapper over @vercel/postgres
  vouchers.ts    # createForOrder, getByToken, redeem (atomic)
  email.ts       # sendVoucherEmail (Resend + HTML template)
  qr.ts          # tokenToDataUrl
  pins.ts        # parsePartnerPins, storeForPin
  hmac.ts        # verifyShopifyHmac
migrations/
  001_init.sql   # Single-file schema migration
scripts/
  fake-webhook.sh  # Local testing helper (signs a fake payload)
.env.example
README.md
```

Each `lib/*` file has one job and exports a small public surface. Routes are
thin — they validate input, call into `lib/`, and return responses.

## Database schema

```sql
CREATE TABLE vouchers (
  token          TEXT PRIMARY KEY,            -- 32-char hex (crypto.randomBytes(16))
  order_id       TEXT NOT NULL,
  order_number   TEXT NOT NULL,
  email          TEXT NOT NULL,
  product_name   TEXT NOT NULL,
  partner_store  TEXT,                        -- NULL until redeemed
  used           BOOLEAN NOT NULL DEFAULT FALSE,
  used_at        TIMESTAMPTZ,                 -- NULL until redeemed
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX vouchers_order_id_idx ON vouchers(order_id);
```

Index on `order_id` for the idempotency check.

## Endpoints

### `POST /api/shopify-webhook`

1. Read raw body as text (required for HMAC).
2. Verify `X-Shopify-Hmac-Sha256` header via constant-time compare of
   `base64(hmacSha256(SHOPIFY_WEBHOOK_SECRET, rawBody))`. Mismatch → 401.
3. Parse JSON.
4. **Idempotency:** `SELECT 1 FROM vouchers WHERE order_id=$1 LIMIT 1`. If exists,
   return 200 immediately with `{ status: "duplicate" }`.
5. For each line item, for each unit (`1..item.quantity`):
   - Generate token: `crypto.randomBytes(16).toString('hex')`
   - Insert row with order/email/product fields
6. Generate QR data URLs for every token created
   (`https://${BASE_URL}/redeem/{token}`).
7. Send one email via Resend with all QR codes inline.
8. Return 200.

**Quantity behavior:** one voucher per unit. `quantity: 3` → 3 inserted rows,
3 QR codes in the email.

**Email failure handling:** If Resend throws, return 500 so Shopify retries.
On retry, the idempotency check will prevent duplicate inserts but *will*
resend the email. Acceptable trade-off for v1.

### `GET /redeem/[token]`

Server component. Looks up the voucher:

- Not found → "Invalid voucher" page (don't leak whether token ever existed).
- `used = true` → "Already redeemed on {used_at} at {partner_store}".
- Valid + unused → Show order number, product name, 4-digit PIN input, and
  "Mark as Redeemed" button that POSTs to `/api/redeem/{token}`.

Mobile-first styling: large text, full-width buttons, single-column.

### `POST /api/redeem/[token]`

1. Parse JSON body: `{ pin: string }`.
2. Look up store in `PARTNER_PINS` env (`storeA:1234,storeB:5678`). No match → 401.
3. Atomic update:
   ```sql
   UPDATE vouchers
   SET used = TRUE, used_at = NOW(), partner_store = $1
   WHERE token = $2 AND used = FALSE
   ```
4. Check rows affected:
   - 1 → success. Return 303 redirect to `/redeem/{token}` (page re-renders as "Already redeemed").
   - 0 → race lost or invalid token. Return 409 with "Already redeemed or invalid".

## Edge cases & invariants

| Concern | Handling |
|---|---|
| HMAC tampering | 401, no DB writes |
| Shopify webhook retry | Idempotent on `order_id` (skip insert; email may resend) |
| Two staff scan same QR simultaneously | Atomic `UPDATE WHERE used=false`; only one row affected |
| Customer visits valid `/redeem/{token}` URL repeatedly | Read-only; no state change until form is POSTed |
| Invalid token | Generic "Invalid voucher" page (404 status) |
| Wrong PIN | 401, no DB writes |
| Resend API failure | Return 500 → Shopify retries → vouchers already saved → email retries |
| Token guessing | 16 bytes = 128 bits of entropy. Brute-force infeasible. |

## Environment variables (.env.example)

```
SHOPIFY_WEBHOOK_SECRET=         # From Shopify webhook config
POSTGRES_URL=                   # Auto-set by Vercel Postgres integration
RESEND_API_KEY=                 # From resend.com
FROM_EMAIL=                     # e.g. vouchers@yourdomain.com
BASE_URL=                       # e.g. https://vouchers.yourdomain.com
PARTNER_PINS=                   # storeA:1234,storeB:5678
```

## Testing approach

Documented in README:

1. Run migration: `psql $POSTGRES_URL -f migrations/001_init.sql`
2. `npm run dev`
3. Fire a fake signed webhook via `scripts/fake-webhook.sh` (computes HMAC with
   the local secret and curls the dev server)
4. Check the dev server logs for the QR code email content (Resend sandbox or
   real Resend with test FROM_EMAIL)
5. Open `/redeem/{token}` in a browser, enter a test PIN, verify state changes

## Out of scope (v1)

- Admin dashboard for viewing/managing vouchers (use raw SQL per README)
- Customer-facing "lost my email" recovery flow
- Multi-language support for the redeem page
- Detailed analytics / redemption reporting
- Voucher expiry dates
- Refund handling (Shopify `orders/cancelled` webhook)
