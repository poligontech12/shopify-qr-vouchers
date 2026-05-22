import { NextRequest, NextResponse } from "next/server";
import { parsePartnerPins, storeForPin } from "@/lib/pins";
import { verifyToken } from "@/lib/tokens";
import { tryRedeem } from "@/lib/redemptions";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const secret = process.env.TOKEN_SECRET;
  if (!secret) {
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const parts = verifyToken(params.token, secret);
  if (!parts) {
    return new NextResponse("Invalid voucher", { status: 401 });
  }

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

  const result = await tryRedeem(parts, store);
  if (result === "ok") {
    return NextResponse.json({ status: "ok", store });
  }
  return new NextResponse("Already redeemed", { status: 409 });
}
