import { verifyToken } from "@/lib/tokens";
import { getRedemption } from "@/lib/redemptions";
import { RedeemForm } from "./RedeemForm";

export const dynamic = "force-dynamic";

export default async function RedeemPage({
  params,
}: {
  params: { token: string };
}) {
  const secret = process.env.TOKEN_SECRET;
  if (!secret) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-2xl font-bold text-red-600">Server misconfigured</h1>
      </main>
    );
  }

  const parts = verifyToken(params.token, secret);
  if (!parts) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-2xl font-bold text-red-600">Invalid voucher</h1>
        <p className="mt-2 text-gray-600">
          This code is not recognized. Please check the QR or contact support.
        </p>
      </main>
    );
  }

  const redemption = await getRedemption(parts);
  if (redemption) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-700">Already redeemed</h1>
        <p className="mt-4 text-lg">
          Redeemed on{" "}
          <strong>{new Date(redemption.redeemed_at).toLocaleString()}</strong>
        </p>
        <p className="mt-2 text-lg">
          at <strong>{redemption.partner_store}</strong>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">Voucher ready to redeem</h1>
      <div className="mt-4 rounded-lg border bg-white p-4">
        <p className="text-sm uppercase text-gray-500">Order</p>
        <p className="text-lg font-semibold">#{parts.orderId}</p>
        <p className="mt-3 text-sm uppercase text-gray-500">Item</p>
        <p className="text-lg">
          #{parts.lineItemId} (unit {parts.unitIndex})
        </p>
      </div>
      <RedeemForm token={params.token} />
    </main>
  );
}
