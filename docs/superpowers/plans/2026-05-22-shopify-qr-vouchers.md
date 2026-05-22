# Shopify QR Voucher System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 14 app that receives Shopify order webhooks, generates single-use QR vouchers, emails them to customers, and lets partner-store staff redeem them with a PIN.

**Architecture:** Webhook handler creates one DB row per purchased unit, embeds a QR-code data URL per voucher in a single email. A redemption page reads the row by token and shows status; a POST endpoint atomically marks it used (`UPDATE ... WHERE used=false` returning rows affected) so concurrent scans can't double-redeem.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind, `@vercel/postgres`, Resend, `qrcode`, Vitest for unit tests.

---

## File map

| File | Responsibility |
|---|---|
| `package.json` | Deps + scripts |
| `tsconfig.json` | TypeScript config (Next.js defaults) |
| `next.config.mjs` | Next.js config (empty) |
| `tailwind.config.ts` | Tailwind content paths |
| `postcss.config.mjs` | PostCSS plugins |
| `vitest.config.ts` | Vitest setup |
| `.env.example` | Documented env vars |
| `.gitignore` | Node/Next defaults + `.env*` |
| `app/layout.tsx` | Root HTML shell |
| `app/globals.css` | Tailwind directives |
| `app/redeem/[token]/page.tsx` | Server component: voucher status |
| `app/redeem/[token]/RedeemForm.tsx` | Client component: PIN form |
| `app/api/shopify-webhook/route.ts` | Webhook handler |
| `app/api/redeem/[token]/route.ts` | Redemption handler |
| `lib/db.ts` | `@vercel/postgres` re-export wrapper |
| `lib/vouchers.ts` | `createForOrder`, `getByToken`, `redeem` |
| `lib/email.ts` | `sendVoucherEmail` |
| `lib/qr.ts` | `tokenToDataUrl` |
| `lib/pins.ts` | `parsePartnerPins`, `storeForPin` |
| `lib/hmac.ts` | `verifyShopifyHmac` |
| `migrations/001_init.sql` | Schema migration |
| `scripts/fake-webhook.sh` | Local-dev signed webhook helper |
| `README.md` | Setup, deploy, ops docs |

Unit tests live next to the file as `*.test.ts` (only for pure utilities — DB code is verified end-to-end via the fake-webhook script).

---

## Task 1: Bootstrap Next.js project skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `app/layout.tsx`
- Create: `app/globals.css`

- [ ] **Step 1: Initialize git**

Run:
```bash
cd /Users/georgejucan/ClaudeCode/AlterraPlugin
git init -q
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "shopify-qr-vouchers",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "14.2.15",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "@vercel/postgres": "0.10.0",
    "resend": "4.0.1",
    "qrcode": "1.5.4"
  },
  "devDependencies": {
    "typescript": "5.6.3",
    "@types/node": "20.16.10",
    "@types/react": "18.3.11",
    "@types/react-dom": "18.3.0",
    "@types/qrcode": "1.5.5",
    "tailwindcss": "3.4.13",
    "postcss": "8.4.47",
    "autoprefixer": "10.4.20",
    "vitest": "2.1.2"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

- [ ] **Step 5: Create `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

- [ ] **Step 6: Create `postcss.config.mjs`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 7: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 8: Create `.gitignore`**

```
node_modules/
.next/
.env
.env.local
.env*.local
dist/
*.log
.DS_Store
.vercel/
```

- [ ] **Step 9: Create `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 10: Create `app/layout.tsx`**

```tsx
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Vouchers",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 11: Install dependencies**

Run:
```bash
npm install
```
Expected: completes without errors. A `package-lock.json` is created.

- [ ] **Step 12: Verify scaffold builds**

Run:
```bash
npx tsc --noEmit
```
Expected: no output (success). A `next-env.d.ts` may be auto-generated.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs vitest.config.ts .gitignore app/layout.tsx app/globals.css
git commit -m "chore: scaffold Next.js 14 project with Tailwind and Vitest"
```

---

## Task 2: Database migration

**Files:**
- Create: `migrations/001_init.sql`

- [ ] **Step 1: Create `migrations/001_init.sql`**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add migrations/001_init.sql
git commit -m "feat: add vouchers table migration"
```

---

## Task 3: HMAC verification utility (TDD)

**Files:**
- Create: `lib/hmac.ts`
- Test: `lib/hmac.test.ts`

- [ ] **Step 1: Write the failing test `lib/hmac.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyShopifyHmac } from "./hmac";

const secret = "test-secret";
const body = '{"hello":"world"}';
const validSig = crypto.createHmac("sha256", secret).update(body).digest("base64");

describe("verifyShopifyHmac", () => {
  it("returns true for a valid signature", () => {
    expect(verifyShopifyHmac(body, validSig, secret)).toBe(true);
  });

  it("returns false for a tampered body", () => {
    expect(verifyShopifyHmac(body + "x", validSig, secret)).toBe(false);
  });

  it("returns false for a wrong secret", () => {
    expect(verifyShopifyHmac(body, validSig, "wrong-secret")).toBe(false);
  });

  it("returns false for a malformed signature", () => {
    expect(verifyShopifyHmac(body, "not-base64!!!", secret)).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(verifyShopifyHmac(body, "", secret)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run lib/hmac.test.ts
```
Expected: FAIL — cannot resolve `./hmac`.

- [ ] **Step 3: Implement `lib/hmac.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run lib/hmac.test.ts
```
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/hmac.ts lib/hmac.test.ts
git commit -m "feat: add Shopify HMAC verification utility"
```

---

## Task 4: PIN parsing utility (TDD)

**Files:**
- Create: `lib/pins.ts`
- Test: `lib/pins.test.ts`

- [ ] **Step 1: Write the failing test `lib/pins.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parsePartnerPins, storeForPin } from "./pins";

describe("parsePartnerPins", () => {
  it("parses a simple two-store env value", () => {
    expect(parsePartnerPins("storeA:1234,storeB:5678")).toEqual({
      "1234": "storeA",
      "5678": "storeB",
    });
  });

  it("trims whitespace around entries", () => {
    expect(parsePartnerPins(" storeA : 1234 , storeB : 5678 ")).toEqual({
      "1234": "storeA",
      "5678": "storeB",
    });
  });

  it("ignores empty entries", () => {
    expect(parsePartnerPins("storeA:1234,,storeB:5678,")).toEqual({
      "1234": "storeA",
      "5678": "storeB",
    });
  });

  it("returns empty record for empty input", () => {
    expect(parsePartnerPins("")).toEqual({});
    expect(parsePartnerPins(undefined)).toEqual({});
  });

  it("skips malformed entries (no colon)", () => {
    expect(parsePartnerPins("storeA:1234,broken,storeB:5678")).toEqual({
      "1234": "storeA",
      "5678": "storeB",
    });
  });
});

describe("storeForPin", () => {
  const pins = { "1234": "storeA", "5678": "storeB" };

  it("returns store name for a matching pin", () => {
    expect(storeForPin(pins, "1234")).toBe("storeA");
    expect(storeForPin(pins, "5678")).toBe("storeB");
  });

  it("returns null for a non-matching pin", () => {
    expect(storeForPin(pins, "9999")).toBeNull();
  });

  it("returns null for empty pin", () => {
    expect(storeForPin(pins, "")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run lib/pins.test.ts
```
Expected: FAIL — cannot resolve `./pins`.

- [ ] **Step 3: Implement `lib/pins.ts`**

```ts
export type PinMap = Record<string, string>;

export function parsePartnerPins(raw: string | undefined): PinMap {
  if (!raw) return {};
  const map: PinMap = {};
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const store = trimmed.slice(0, colon).trim();
    const pin = trimmed.slice(colon + 1).trim();
    if (!store || !pin) continue;
    map[pin] = store;
  }
  return map;
}

export function storeForPin(pins: PinMap, pin: string): string | null {
  if (!pin) return null;
  return pins[pin] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run lib/pins.test.ts
```
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pins.ts lib/pins.test.ts
git commit -m "feat: add partner PIN parsing utility"
```

---

## Task 5: QR code data-URL utility (TDD)

**Files:**
- Create: `lib/qr.ts`
- Test: `lib/qr.test.ts`

- [ ] **Step 1: Write the failing test `lib/qr.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { tokenToDataUrl } from "./qr";

describe("tokenToDataUrl", () => {
  it("returns a PNG data URL for a given URL", async () => {
    const url = await tokenToDataUrl("https://example.com/redeem/abc123");
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    // Base64 payload should be non-trivial in size
    expect(url.length).toBeGreaterThan(200);
  });

  it("produces different output for different inputs", async () => {
    const a = await tokenToDataUrl("https://example.com/redeem/aaa");
    const b = await tokenToDataUrl("https://example.com/redeem/bbb");
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run lib/qr.test.ts
```
Expected: FAIL — cannot resolve `./qr`.

- [ ] **Step 3: Implement `lib/qr.ts`**

```ts
import QRCode from "qrcode";

export async function tokenToDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run lib/qr.test.ts
```
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/qr.ts lib/qr.test.ts
git commit -m "feat: add QR code data-URL generator"
```

---

## Task 6: Database connection wrapper

**Files:**
- Create: `lib/db.ts`

- [ ] **Step 1: Implement `lib/db.ts`**

```ts
// Thin re-export so other modules import a stable surface and we can swap
// drivers later without touching callers.
export { sql } from "@vercel/postgres";
```

- [ ] **Step 2: Verify it type-checks**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db.ts
git commit -m "feat: add db wrapper module"
```

---

## Task 7: Voucher CRUD module

**Files:**
- Create: `lib/vouchers.ts`

- [ ] **Step 1: Implement `lib/vouchers.ts`**

```ts
import crypto from "node:crypto";
import { sql } from "./db";

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
  const { rows } = await sql`
    SELECT 1 FROM vouchers WHERE order_id = ${orderId} LIMIT 1
  `;
  return rows.length > 0;
}

export async function createVouchers(
  items: NewVoucherInput[],
): Promise<string[]> {
  const tokens: string[] = [];
  for (const item of items) {
    const token = crypto.randomBytes(16).toString("hex");
    await sql`
      INSERT INTO vouchers (token, order_id, order_number, email, product_name)
      VALUES (${token}, ${item.order_id}, ${item.order_number}, ${item.email}, ${item.product_name})
    `;
    tokens.push(token);
  }
  return tokens;
}

export async function getByToken(token: string): Promise<Voucher | null> {
  const { rows } = await sql<Voucher>`
    SELECT token, order_id, order_number, email, product_name,
           partner_store, used, used_at, created_at
    FROM vouchers
    WHERE token = ${token}
    LIMIT 1
  `;
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
  const result = await sql`
    UPDATE vouchers
    SET used = TRUE, used_at = NOW(), partner_store = ${partnerStore}
    WHERE token = ${token} AND used = FALSE
  `;
  return result.rowCount === 1 ? "ok" : "already_used_or_missing";
}
```

- [ ] **Step 2: Verify it type-checks**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/vouchers.ts
git commit -m "feat: add voucher creation, lookup, and atomic redeem"
```

---

## Task 8: Email module (Resend + HTML template)

**Files:**
- Create: `lib/email.ts`

- [ ] **Step 1: Implement `lib/email.ts`**

```ts
import { Resend } from "resend";

export type VoucherEmailInput = {
  to: string;
  orderNumber: string;
  items: Array<{
    productName: string;
    qrDataUrl: string;
    redeemUrl: string;
  }>;
};

function renderHtml(input: VoucherEmailInput): string {
  const rows = input.items
    .map(
      (item) => `
        <tr>
          <td style="padding: 24px 0; border-bottom: 1px solid #eee;">
            <p style="margin: 0 0 8px; font-size: 18px; font-weight: 600;">
              ${escapeHtml(item.productName)}
            </p>
            <img src="${item.qrDataUrl}" alt="QR code" width="240" height="240" style="display: block; margin: 12px 0;" />
            <p style="margin: 0; font-size: 12px; color: #666;">
              Or open: <a href="${item.redeemUrl}">${escapeHtml(item.redeemUrl)}</a>
            </p>
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 24px; margin: 0 0 8px;">Your voucher${input.items.length > 1 ? "s" : ""}</h1>
        <p style="color: #555; margin: 0 0 24px;">
          Order #${escapeHtml(input.orderNumber)}. Show ${input.items.length > 1 ? "each QR code" : "this QR code"} at the partner store to redeem.
        </p>
        <table style="width: 100%; border-collapse: collapse;">${rows}</table>
        <p style="font-size: 12px; color: #888; margin-top: 24px;">
          Each code can only be redeemed once.
        </p>
      </body>
    </html>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendVoucherEmail(
  input: VoucherEmailInput,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  if (!from) throw new Error("FROM_EMAIL is not set");

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: `Your voucher for order #${input.orderNumber}`,
    html: renderHtml(input),
  });
  if (error) throw new Error(`Resend error: ${error.message ?? "unknown"}`);
}
```

- [ ] **Step 2: Verify it type-checks**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/email.ts
git commit -m "feat: add Resend voucher email sender with inline QR images"
```

---

## Task 9: Shopify webhook route

**Files:**
- Create: `app/api/shopify-webhook/route.ts`

- [ ] **Step 1: Implement `app/api/shopify-webhook/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyHmac } from "@/lib/hmac";
import {
  orderHasVouchers,
  createVouchers,
  type NewVoucherInput,
} from "@/lib/vouchers";
import { tokenToDataUrl } from "@/lib/qr";
import { sendVoucherEmail } from "@/lib/email";

export const runtime = "nodejs";

type ShopifyLineItem = {
  title: string;
  quantity: number;
};

type ShopifyOrder = {
  id: number | string;
  order_number: number | string;
  email: string;
  line_items: ShopifyLineItem[];
};

export async function POST(req: NextRequest) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const baseUrl = process.env.BASE_URL;
  if (!secret || !baseUrl) {
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-shopify-hmac-sha256") ?? "";
  if (!verifyShopifyHmac(rawBody, signature, secret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let order: ShopifyOrder;
  try {
    order = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const orderId = String(order.id);
  const orderNumber = String(order.order_number);
  const email = order.email;

  if (!email || !order.line_items?.length) {
    return new NextResponse("Missing email or line items", { status: 400 });
  }

  // Idempotency: webhook retries must not duplicate vouchers.
  if (await orderHasVouchers(orderId)) {
    return NextResponse.json({ status: "duplicate" }, { status: 200 });
  }

  // Expand quantities — one voucher per purchased unit.
  const newVouchers: NewVoucherInput[] = [];
  for (const item of order.line_items) {
    const qty = Math.max(1, Math.floor(item.quantity ?? 1));
    for (let i = 0; i < qty; i++) {
      newVouchers.push({
        order_id: orderId,
        order_number: orderNumber,
        email,
        product_name: item.title,
      });
    }
  }

  const tokens = await createVouchers(newVouchers);

  const emailItems = await Promise.all(
    tokens.map(async (token, idx) => {
      const redeemUrl = `${baseUrl.replace(/\/$/, "")}/redeem/${token}`;
      const qrDataUrl = await tokenToDataUrl(redeemUrl);
      return {
        productName: newVouchers[idx].product_name,
        qrDataUrl,
        redeemUrl,
      };
    }),
  );

  await sendVoucherEmail({
    to: email,
    orderNumber,
    items: emailItems,
  });

  return NextResponse.json({ status: "ok", count: tokens.length });
}
```

- [ ] **Step 2: Verify it type-checks**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/shopify-webhook/route.ts
git commit -m "feat: add Shopify webhook handler with HMAC and idempotency"
```

---

## Task 10: Redeem page (server component)

**Files:**
- Create: `app/redeem/[token]/page.tsx`

- [ ] **Step 1: Implement `app/redeem/[token]/page.tsx`**

```tsx
import { getByToken } from "@/lib/vouchers";
import { RedeemForm } from "./RedeemForm";

export const dynamic = "force-dynamic";

export default async function RedeemPage({
  params,
}: {
  params: { token: string };
}) {
  const voucher = await getByToken(params.token);

  if (!voucher) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-2xl font-bold text-red-600">Invalid voucher</h1>
        <p className="mt-2 text-gray-600">
          This code is not recognized. Please check the QR or contact support.
        </p>
      </main>
    );
  }

  if (voucher.used) {
    const usedAt = voucher.used_at
      ? new Date(voucher.used_at).toLocaleString()
      : "unknown time";
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-700">Already redeemed</h1>
        <p className="mt-4 text-lg">
          Redeemed on <strong>{usedAt}</strong>
        </p>
        <p className="mt-2 text-lg">
          at <strong>{voucher.partner_store ?? "unknown store"}</strong>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">Voucher ready to redeem</h1>
      <div className="mt-4 rounded-lg border bg-white p-4">
        <p className="text-sm uppercase text-gray-500">Order</p>
        <p className="text-lg font-semibold">#{voucher.order_number}</p>
        <p className="mt-3 text-sm uppercase text-gray-500">Product</p>
        <p className="text-lg">{voucher.product_name}</p>
      </div>
      <RedeemForm token={voucher.token} />
    </main>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors (`RedeemForm` import will fail; that's expected — next task fixes it).

If TypeScript flags the missing import, proceed anyway — Task 11 creates `RedeemForm`. Skip this step's expected output and move on.

- [ ] **Step 3: Commit**

```bash
git add app/redeem/[token]/page.tsx
git commit -m "feat: add redeem status page (invalid/used/valid states)"
```

---

## Task 11: Redeem form (client) + redemption API route

**Files:**
- Create: `app/redeem/[token]/RedeemForm.tsx`
- Create: `app/api/redeem/[token]/route.ts`

- [ ] **Step 1: Implement `app/redeem/[token]/RedeemForm.tsx`**

```tsx
"use client";
import { useState, type FormEvent } from "react";

export function RedeemForm({ token }: { token: string }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/redeem/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        // Refresh so the server component re-renders as "Already redeemed".
        window.location.reload();
        return;
      }
      const text = await res.text();
      setError(text || "Could not redeem");
      setSubmitting(false);
    } catch {
      setError("Network error — please try again");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Store PIN</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-4 text-center text-2xl tracking-widest"
          placeholder="••••"
          autoFocus
        />
      </label>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting || pin.length < 4}
        className="w-full rounded-md bg-green-600 px-4 py-4 text-lg font-semibold text-white disabled:bg-gray-400"
      >
        {submitting ? "Redeeming…" : "Mark as Redeemed"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Implement `app/api/redeem/[token]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { parsePartnerPins, storeForPin } from "@/lib/pins";
import { redeem } from "@/lib/vouchers";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  let body: { pin?: string };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const pin = (body.pin ?? "").trim();
  const pins = parsePartnerPins(process.env.PARTNER_PINS);
  const store = storeForPin(pins, pin);
  if (!store) {
    return new NextResponse("Invalid PIN", { status: 401 });
  }

  const result = await redeem(params.token, store);
  if (result === "ok") {
    return NextResponse.json({ status: "ok", store });
  }
  return new NextResponse("Already redeemed or invalid token", { status: 409 });
}
```

- [ ] **Step 3: Verify the whole project builds**

Run:
```bash
npx next build
```
Expected: build succeeds. Routes listed include `/redeem/[token]`, `/api/redeem/[token]`, `/api/shopify-webhook`.

(If build fails because of missing `POSTGRES_URL` at build time, that's fine — set a dummy value: `POSTGRES_URL=postgresql://x:x@x:5432/x npx next build`. The connection only opens at request time.)

- [ ] **Step 4: Commit**

```bash
git add app/redeem/[token]/RedeemForm.tsx app/api/redeem/[token]/route.ts
git commit -m "feat: add PIN form and redemption API with atomic update"
```

---

## Task 12: Fake-webhook helper script

**Files:**
- Create: `scripts/fake-webhook.sh`

- [ ] **Step 1: Implement `scripts/fake-webhook.sh`**

```bash
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
```

- [ ] **Step 2: Make it executable**

Run:
```bash
chmod +x scripts/fake-webhook.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/fake-webhook.sh
git commit -m "chore: add fake-webhook helper script for local testing"
```

---

## Task 13: .env.example and README

**Files:**
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: Create `.env.example`**

```
# Shopify webhook signing secret (Admin → Settings → Notifications → Webhooks)
SHOPIFY_WEBHOOK_SECRET=

# Postgres connection string. On Vercel this is auto-injected by the
# Vercel Postgres integration. Locally, point at any Postgres instance.
POSTGRES_URL=

# Resend API key (resend.com → API Keys)
RESEND_API_KEY=

# Verified sender address on your Resend domain
FROM_EMAIL=

# Public base URL of this deployment (no trailing slash)
BASE_URL=http://localhost:3000

# Partner store PINs, comma-separated as store:pin
# The matched store name is recorded on the voucher row at redemption.
PARTNER_PINS=storeA:1234,storeB:5678
```

- [ ] **Step 2: Create `README.md`**

````markdown
# Shopify Single-Use QR Voucher System

Receives Shopify order webhooks, emails customers a QR code per purchased unit, and lets partner-store staff redeem each QR exactly once with a store PIN.

## Local development

1. Install dependencies:
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
````

- [ ] **Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "docs: add env example and README"
```

---

## Task 14: End-to-end manual verification

**Goal:** confirm the running system behaves as designed before declaring done.

- [ ] **Step 1: Ensure local Postgres is reachable**

If you don't already have one running, the fastest option is Docker:
```bash
docker run -d --name vouchers-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=vouchers \
  -p 5432:5432 postgres:16
```
Set in `.env.local`:
```
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/vouchers
```

- [ ] **Step 2: Apply migration**

```bash
psql "postgresql://postgres:postgres@localhost:5432/vouchers" -f migrations/001_init.sql
```
Expected: `CREATE TABLE` and `CREATE INDEX`.

- [ ] **Step 3: Start dev server**

```bash
npm run dev
```
Expected: `Local: http://localhost:3000`.

- [ ] **Step 4: Fire a fake webhook**

In a second terminal:
```bash
export SHOPIFY_WEBHOOK_SECRET=<value from .env.local>
./scripts/fake-webhook.sh
```
Expected: response `{"status":"ok","count":3}` (1 unit of Product A + 2 of Product B). Dev server logs show the request.

- [ ] **Step 5: Verify rows exist**

```bash
psql "$POSTGRES_URL" -c "SELECT token, product_name, used FROM vouchers ORDER BY created_at DESC LIMIT 5;"
```
Expected: 3 rows, all `used=f`.

- [ ] **Step 6: Verify idempotency**

Re-run the fake webhook:
```bash
./scripts/fake-webhook.sh
```
Expected: `{"status":"duplicate"}`. Voucher count unchanged.

- [ ] **Step 7: Test the redeem page**

Grab one token:
```bash
TOKEN=$(psql "$POSTGRES_URL" -tAc "SELECT token FROM vouchers ORDER BY created_at DESC LIMIT 1;")
echo "http://localhost:3000/redeem/$TOKEN"
```
Open the URL in a browser. Expected: order number, product name, PIN field, big green button.

- [ ] **Step 8: Test wrong PIN**

Enter `9999` in the PIN field. Expected: red error "Invalid PIN".

- [ ] **Step 9: Test correct PIN**

Enter `1234` (matches `storeA` in default `PARTNER_PINS`). Expected: page reloads, shows "Already redeemed on ... at storeA".

- [ ] **Step 10: Test re-scan**

Reload the same redeem URL. Expected: same "Already redeemed" page (no PIN form).

- [ ] **Step 11: Test invalid token**

Visit `http://localhost:3000/redeem/deadbeef`. Expected: "Invalid voucher" page.

- [ ] **Step 12: Run unit tests once more**

```bash
npm test
```
Expected: all tests PASS.

- [ ] **Step 13: Commit any final touch-ups**

If any tweaks were needed during verification:
```bash
git add -A
git commit -m "fix: <describe>"
```
Otherwise skip.

---

## Self-review

**Spec coverage:**

| Spec requirement | Implementing task |
|---|---|
| Database schema | Task 2 |
| Webhook HMAC verify | Tasks 3, 9 |
| Voucher creation per unit | Tasks 7, 9 |
| QR generation as data URL | Tasks 5, 9 |
| Single email per order with inline QRs | Tasks 8, 9 |
| Webhook idempotency by `order_id` | Tasks 7, 9 |
| Redeem page (invalid/used/valid states) | Task 10 |
| Mobile-friendly PIN form | Task 11 |
| PIN → store lookup | Tasks 4, 11 |
| Atomic `UPDATE WHERE used=false` | Tasks 7, 11 |
| Race-condition guard via rows-affected | Tasks 7, 11 |
| `.env.example` | Task 13 |
| README with Shopify path + PIN rotation + manual invalidation SQL | Task 13 |
| Local-testing walkthrough (curl + fake webhook) | Tasks 12, 14 |
| Vercel deploy walkthrough | Task 13 |

**Placeholder scan:** none — every code block is complete, every command has expected output, every commit has a message.

**Type consistency:** `RedeemResult`, `Voucher`, `NewVoucherInput`, `PinMap`, `VoucherEmailInput` are defined once each and used consistently. Route handler param types match Next.js 14 App Router signatures.

**Ambiguity:** Task 10's `tsc --noEmit` is expected to fail transiently because `RedeemForm` is created in Task 11 — explicitly called out in the step.
