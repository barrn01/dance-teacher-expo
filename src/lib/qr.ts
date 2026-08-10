import "server-only";
import QRCode from "qrcode";

/** QR code as a PNG data URL, styled in brand ink-on-white. */
export function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 320,
    margin: 1,
    color: { dark: "#171114", light: "#ffffff" },
  });
}

/** QR code as a raw PNG buffer (for email attachments). */
export function qrPngBuffer(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, { width: 320, margin: 1 });
}
