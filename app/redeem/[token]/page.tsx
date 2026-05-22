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
