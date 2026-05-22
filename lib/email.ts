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
