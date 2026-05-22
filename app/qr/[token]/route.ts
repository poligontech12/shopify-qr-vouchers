import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/tokens";
import { urlToQrPng } from "@/lib/qr";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const secret = process.env.TOKEN_SECRET;
  const baseUrl = process.env.BASE_URL;
  if (!secret || !baseUrl) {
    return new Response("Server misconfigured", { status: 500 });
  }

  // Allow optional .png suffix in the URL so email clients that key on file
  // extension (some Outlook variants) still render the image.
  const token = params.token.replace(/\.png$/, "");

  if (!verifyToken(token, secret)) {
    return new Response("Invalid token", { status: 404 });
  }

  const redeemUrl = `${baseUrl.replace(/\/$/, "")}/redeem/${token}`;
  const pngBuffer = await urlToQrPng(redeemUrl);

  return new Response(pngBuffer, {
    status: 200,
    headers: {
      "content-type": "image/png",
      // QR for a given token never changes, so aggressive caching is safe.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
