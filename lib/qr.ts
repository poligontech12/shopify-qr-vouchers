import QRCode from "qrcode";

const QR_OPTIONS = {
  errorCorrectionLevel: "M" as const,
  margin: 1,
  width: 320,
};

export async function urlToQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, QR_OPTIONS);
}
