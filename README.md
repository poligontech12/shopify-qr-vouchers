# Shopify Single-Use QR Voucher System

Receives Shopify order webhooks, emails customers a QR code per purchased unit, and lets partner-store staff redeem each QR exactly once with a store PIN.

## Local development

1. Install dependencies (requires Node 18.17+):
   ```bash
   npm install
   ```

2. Copy env template and fill in values:
   ```bash
   cp .env.example .env.local
   ```
   For local testing you need:
   - `POSTGRES_URL` — any Postgres connection string (use Docker, local install, or `vercel env pull` from a Vercel project)
   - `SHOPIFY_WEBHOOK_SECRET` — any string (used to sign fake webhooks)
   - `RESEND_API_KEY` — get from [resend.com](https://resend.com); use the sandbox key to send to your own verified email
   - `FROM_EMAIL` — a verified sender on Resend
   - `BASE_URL=http://localhost:3000`
   - `PARTNER_PINS=storeA:1234,storeB:5678`

3. Run the migration once against your local Postgres:
   ```bash
   psql "$POSTGRES_URL" -f migrations/001_init.sql
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```

5. Run unit tests:
   ```bash
   npm test
   ```

## Testing the webhook locally

The `scripts/fake-webhook.sh` helper signs and POSTs a sample payload:

```bash
export SHOPIFY_WEBHOOK_SECRET=<same value as in .env.local>
./scripts/fake-webhook.sh
```

Expected: a JSON response like `{"status":"ok","count":3}` and an email arriving at `test@example.com` (change the payload's `email` field for a real test).

To send a custom payload:
```bash
./scripts/fake-webhook.sh http://localhost:3000/api/shopify-webhook ./my-order.json
```

Open the redeem URL from any voucher row:
```bash
psql "$POSTGRES_URL" -c "SELECT token FROM vouchers ORDER BY created_at DESC LIMIT 1;"
```
Then visit `http://localhost:3000/redeem/<token>` and enter a PIN (e.g. `1234`).

## Deploying to Vercel

1. Push this repo to GitHub.
2. In the Vercel dashboard, **New Project** → import the repo.
3. **Storage** tab → **Create Database** → Postgres. Vercel will inject `POSTGRES_URL` automatically.
   - Note: Vercel Postgres has been replaced by Neon. The `POSTGRES_URL` env var is still auto-injected and works with the `@vercel/postgres` package this project uses. Long-term you may want to migrate to the `@neondatabase/serverless` SDK directly (one-file change in `lib/db.ts`).
4. Open a SQL console in the Storage tab (or use `psql` with `vercel env pull`) and run the contents of `migrations/001_init.sql` once.
5. In **Settings → Environment Variables**, add:
   - `SHOPIFY_WEBHOOK_SECRET`
   - `RESEND_API_KEY`
   - `FROM_EMAIL`
   - `BASE_URL` — the production URL Vercel assigns (e.g. `https://your-app.vercel.app`)
   - `PARTNER_PINS`
6. Trigger a redeploy so the new vars are picked up.

## Registering the Shopify webhook

In your Shopify Admin:
1. **Settings → Notifications → Webhooks**
2. Scroll to **Webhooks** → **Create webhook**
3. Event: **Order payment** (`orders/paid`)
4. Format: **JSON**
5. URL: `https://<your-vercel-domain>/api/shopify-webhook`
6. Webhook API version: latest stable
7. Save. Shopify will reveal the signing secret — copy it into `SHOPIFY_WEBHOOK_SECRET` in Vercel env vars and redeploy.

## Managing partner PINs

PINs live in the `PARTNER_PINS` env var, formatted as:
```
storeA:1234,storeB:5678,storeC:0420
```

To rotate or add a PIN:
1. Update the value in Vercel **Settings → Environment Variables**.
2. Redeploy (Vercel does this automatically on env var change for new requests).

The PIN that staff enters determines which `partner_store` is recorded on the voucher, so use distinct store names.

## Manually invalidating a voucher

To mark a voucher used without going through the redeem page (e.g. customer requested a refund):
```sql
UPDATE vouchers
SET used = TRUE,
    used_at = NOW(),
    partner_store = 'admin-invalidated'
WHERE token = '<the-token>';
```

To delete a voucher entirely (rarely needed):
```sql
DELETE FROM vouchers WHERE token = '<the-token>';
```

To see all unredeemed vouchers for an order:
```sql
SELECT token, product_name, created_at
FROM vouchers
WHERE order_id = '<shopify-order-id>' AND used = FALSE;
```

## How it works

| Component | Responsibility |
|---|---|
| `app/api/shopify-webhook/route.ts` | Verifies HMAC, checks for duplicate order, expands line item quantities, creates vouchers, sends one email |
| `app/redeem/[token]/page.tsx` | Server-renders one of three states: invalid token, already redeemed, or valid + PIN form |
| `app/redeem/[token]/RedeemForm.tsx` | Client-side PIN entry that POSTs to the API and reloads on success |
| `app/api/redeem/[token]/route.ts` | Validates PIN against `PARTNER_PINS`, performs atomic `UPDATE ... WHERE used=false` |
| `lib/hmac.ts` | Constant-time HMAC verify |
| `lib/vouchers.ts` | DB layer: lookup, insert, atomic redeem |
| `lib/qr.ts` | `qrcode` → data URL |
| `lib/email.ts` | Resend send with inline QR `<img>` tags |
| `lib/pins.ts` | `PARTNER_PINS` parse + lookup |

## Idempotency and race conditions

- **Webhook retries:** if Shopify retries (e.g. our first response was slow), the second request hits an idempotency check on `order_id` and returns 200 without creating duplicates. Email *may* re-send.
- **Concurrent redemption:** the `UPDATE ... WHERE token=? AND used=false` returns row count = 1 only for the first writer. The losing writer sees `rowCount=0` and gets a 409.

## Security notes

- Tokens are 16 random bytes (128 bits) — infeasible to brute-force.
- HMAC verification uses `crypto.timingSafeEqual`.
- Invalid tokens return the same generic "Invalid voucher" page (no info leak).
- PINs are stored as plain text in env vars by design (4-digit PINs aren't sensitive crypto material; rotation is the security model).

## Notes on data URLs in email

This project embeds QR codes as `<img src="data:image/png;base64,...">`. This works in most modern clients (Apple Mail, Outlook, mobile clients). **Gmail's web client may block data URLs in some configurations** — if you see broken images in Gmail, switch `lib/email.ts` to use Resend's `attachments` field with `cid` references (a small, well-bounded change).
