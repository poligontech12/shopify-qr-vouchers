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
