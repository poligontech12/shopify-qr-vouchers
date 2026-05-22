# Shopify Single-Use QR Voucher System

Customers buy a product on Shopify and receive QR code(s) **inside Shopify's own order-confirmation email** (via a Liquid snippet — no extra email service needed). Each QR is single-use: staff at a partner store scan it, enter a store PIN, and the voucher is marked redeemed atomically.

## Architecture

```
Customer pays on Shopify
        │
        ▼
Shopify sends "Order paid" notification email
        │  (your Liquid snippet runs here)
        ▼
For each line item, for each unit, the snippet computes a signed token
  token = {orderId}.{lineItemId}.{unitIndex}.{hmac_sha256(payload, SECRET)}
and embeds <img src="https://your-app/qr/{token}.png" />
        │
        ▼
Customer arrives at partner store, shows QR
        │
        ▼
Staff scans → opens https://your-app/redeem/{token}
        │
        ▼
Server: verifyToken() → check redemptions table
   ├── token signature invalid     → "Invalid voucher"
   ├── redemption row exists       → "Already redeemed at {store} on {time}"
   └── valid + unused              → render PIN form
                                              │
                                              ▼
                            Staff enters PIN → POST /api/redeem/{token}
                                              │
                                              ▼
                            INSERT INTO redemptions ... ON CONFLICT DO NOTHING
                            rowCount=1 → ok      rowCount=0 → 409 already used
```

**Why no webhook + no transactional email service?** Tokens are HMAC-signed, so we don't need to pre-create rows in our database — the server can verify any token came from us just by recomputing the HMAC. The only thing that needs persisting is *the fact a token has been redeemed*, plus by whom.

## Local development

1. Install dependencies (requires Node 18.17+):
   ```bash
   npm install
   ```

2. Copy env template and fill in values:
   ```bash
   cp .env.example .env.local
   ```
   - `TOKEN_SECRET` — generate with `openssl rand -hex 32`. Keep this safe.
   - `POSTGRES_URL` — any Postgres connection string
   - `BASE_URL=http://localhost:3000`
   - `PARTNER_PINS=storeA:1234,storeB:5678`

3. Run the migrations once against your local Postgres:
   ```bash
   psql "$POSTGRES_URL" -f migrations/001_init.sql      # old; safe to skip if you're starting fresh
   psql "$POSTGRES_URL" -f migrations/002_snippet_refactor.sql
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```

5. Run unit tests:
   ```bash
   npm test
   ```

## Testing locally without Shopify

A throwaway one-liner to generate a signed token in Node:

```bash
node -e '
  const c = require("crypto");
  const secret = process.env.TOKEN_SECRET;
  const payload = "1042.99.1";
  const sig = c.createHmac("sha256", secret).update(payload).digest("hex");
  console.log(payload + "." + sig);
'
```

Then visit `http://localhost:3000/redeem/<that-token>` in a browser, or grab the QR PNG from `http://localhost:3000/qr/<that-token>.png`.

To exercise the API directly with curl:

```bash
TOKEN="1042.99.1.<sig>"
# Wrong PIN
curl -X POST http://localhost:3000/api/redeem/$TOKEN -H 'content-type: application/json' -d '{"pin":"9999"}'
# Correct PIN
curl -X POST http://localhost:3000/api/redeem/$TOKEN -H 'content-type: application/json' -d '{"pin":"1234"}'
# Retry (now 409)
curl -X POST http://localhost:3000/api/redeem/$TOKEN -H 'content-type: application/json' -d '{"pin":"1234"}'
```

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel: **New Project** → import the repo.
3. **Storage** tab → **Create Database** → Postgres (Neon). `POSTGRES_URL` is auto-injected.
4. Storage → your DB → **Query** → run each statement from `migrations/002_snippet_refactor.sql` **one at a time** (Neon's web SQL editor rejects multi-statement payloads).
5. Settings → **Environment Variables**:
   - `TOKEN_SECRET` — generate with `openssl rand -hex 32`
   - `BASE_URL` — your Vercel URL (e.g. `https://your-app.vercel.app`)
   - `PARTNER_PINS` — e.g. `storeA:1234,storeB:5678`
6. Redeploy to pick up the env vars.

## The Shopify snippet

Paste this into Shopify Admin → **Settings → Notifications → Order confirmation** (or whichever notification you want vouchers to appear in). Edit the two values at the top.

```liquid
{%- comment -%}
  ───────────── Voucher block ─────────────
  Edit these two values and nothing else:
{%- endcomment -%}
{%- assign voucher_secret = "PASTE_YOUR_TOKEN_SECRET_HERE" -%}
{%- assign voucher_base   = "https://your-app.vercel.app" -%}

<div style="margin: 32px 0;">
  <h2 style="font-size: 20px; margin-bottom: 4px;">Your voucher{% if line_items.size > 1 or line_items.first.quantity > 1 %}s{% endif %}</h2>
  <p style="color: #666; margin-top: 0;">Show each QR at the partner store to redeem. Each code can be used once.</p>

  {% for li in line_items %}
    {% for i in (1..li.quantity) %}
      {%- assign payload = order.id | append: "." | append: li.id | append: "." | append: i -%}
      {%- assign sig = payload | hmac_sha256: voucher_secret -%}
      {%- assign token = payload | append: "." | append: sig -%}

      <div style="margin: 24px 0; padding: 16px; border: 1px solid #eee; border-radius: 8px;">
        <p style="font-size: 16px; font-weight: 600; margin: 0 0 4px;">{{ li.title }}</p>
        {% if li.quantity > 1 %}
          <p style="color: #888; font-size: 13px; margin: 0 0 12px;">Voucher {{ i }} of {{ li.quantity }}</p>
        {% endif %}
        <img src="{{ voucher_base }}/qr/{{ token }}.png" alt="QR code" width="240" height="240" style="display: block; margin: 8px 0;" />
        <p style="font-size: 12px; color: #999; margin: 8px 0 0;">
          Or open: <a href="{{ voucher_base }}/redeem/{{ token }}" style="color: #555;">{{ voucher_base }}/redeem/{{ token | slice: 0, 20 }}…</a>
        </p>
      </div>
    {% endfor %}
  {% endfor %}
</div>
```

**How it works:** Shopify's Liquid templating engine has a built-in `hmac_sha256` filter that returns the same lowercase hex string Node's `crypto.createHmac(...).digest("hex")` produces. So the token built in your email is identical to one the server would compute — and the server verifies it on every redeem.

**One trade-off:** the `voucher_secret` lives inside your Shopify email template. Anyone with Admin access to that template can read it. The partner PIN remains the real security boundary — even with a forged URL, no PIN, no redemption.

## Managing partner PINs

PINs live in the `PARTNER_PINS` env var:
```
storeA:1234,storeB:5678,storeC:0420
```

Rotate or add by updating the env var in Vercel and redeploying.

## Manually invalidating or auditing a voucher

```sql
-- Force-redeem a voucher (e.g. customer cancelled, partner accidentally lost the QR):
INSERT INTO redemptions (order_id, line_item_id, unit_index, partner_store)
VALUES ('<order_id>', '<line_item_id>', 1, 'admin-invalidated');

-- See all redemptions for an order:
SELECT * FROM redemptions WHERE order_id = '<order_id>';

-- "Un-redeem" if you marked something used by mistake:
DELETE FROM redemptions
WHERE order_id = '<order_id>' AND line_item_id = '<line_item_id>' AND unit_index = <n>;
```

## File map

| File | Responsibility |
|---|---|
| `app/qr/[token]/route.ts` | Verifies token, renders PNG QR of the corresponding `/redeem/...` URL |
| `app/redeem/[token]/page.tsx` | Verifies token, checks redemption state, renders one of three states |
| `app/redeem/[token]/RedeemForm.tsx` | Client component: PIN entry → POST → reload |
| `app/api/redeem/[token]/route.ts` | Verifies token + PIN, performs atomic INSERT ON CONFLICT |
| `lib/tokens.ts` | `signToken`, `verifyToken` (HMAC-SHA256 hex, matches Liquid) |
| `lib/redemptions.ts` | `getRedemption`, `tryRedeem` (atomic) |
| `lib/qr.ts` | `urlToQrPng` (PNG buffer) |
| `lib/pins.ts` | `PARTNER_PINS` parse + lookup |
| `lib/db.ts` | Shared `pg.Pool` (cached on `globalThis` to survive dev-mode hot reload) |
| `migrations/002_snippet_refactor.sql` | Drops old `vouchers`, creates `redemptions` |

## Security notes

- **Token unforgeability:** HMAC-SHA256 with a 256-bit secret. Anyone without the secret cannot generate valid tokens.
- **Constant-time verification:** `crypto.timingSafeEqual` used on signature comparison.
- **No information leak on invalid tokens:** generic "Invalid voucher" page.
- **PIN as security boundary:** even if the `TOKEN_SECRET` leaks, an attacker still needs a valid partner PIN to redeem.
- **Refund handling:** Shopify won't tell the server about refunds (we removed the webhook). To invalidate a voucher post-refund, use the SQL `INSERT INTO redemptions` snippet above.
