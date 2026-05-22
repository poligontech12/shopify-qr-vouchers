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
