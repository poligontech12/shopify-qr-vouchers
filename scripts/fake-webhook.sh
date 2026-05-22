#!/usr/bin/env bash
# Fires a signed Shopify-style webhook at a local dev server.
# Usage: SHOPIFY_WEBHOOK_SECRET=secret ./scripts/fake-webhook.sh [URL] [PAYLOAD_PATH]
#   URL defaults to http://localhost:3000/api/shopify-webhook
#   PAYLOAD_PATH defaults to a baked-in sample order with two line items
set -euo pipefail

URL="${1:-http://localhost:3000/api/shopify-webhook}"
PAYLOAD_PATH="${2:-}"

if [[ -z "${SHOPIFY_WEBHOOK_SECRET:-}" ]]; then
  echo "Error: SHOPIFY_WEBHOOK_SECRET env var is required" >&2
  exit 1
fi

if [[ -n "$PAYLOAD_PATH" ]]; then
  PAYLOAD="$(cat "$PAYLOAD_PATH")"
else
  # Default sample: 1 unit of Product A + 2 units of Product B
  PAYLOAD=$(cat <<'JSON'
{
  "id": 1001234567890,
  "order_number": "1042",
  "email": "test@example.com",
  "line_items": [
    {"title": "Product A", "quantity": 1},
    {"title": "Product B", "quantity": 2}
  ]
}
JSON
)
fi

SIG=$(printf "%s" "$PAYLOAD" | openssl dgst -sha256 -hmac "$SHOPIFY_WEBHOOK_SECRET" -binary | base64)

echo "POST $URL"
echo "X-Shopify-Hmac-Sha256: $SIG"
echo
curl -sS -X POST "$URL" \
  -H "content-type: application/json" \
  -H "x-shopify-hmac-sha256: $SIG" \
  --data "$PAYLOAD"
echo
