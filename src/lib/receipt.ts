import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Seller identity for the tax invoice. GST is 10% and attendee prices are
// GST-inclusive, so GST = total / 11.
const SELLER_NAME = "Dance Teacher Expo";
const SELLER_ABN = "17 611 514 580";
const SELLER_CONTACT = "tickets@updates.danceteacherexpo.com.au";

export type ReceiptLine = { description: string; amountCents: number };

export type ReceiptOptions = {
  orderNumber: string;
  dateISO: string; // order/payment date
  buyerName?: string | null;
  buyerEmail: string;
  lines: ReceiptLine[];
  totalCents: number;
  currency?: string;
};

const money = (cents: number) =>
  "$" +
  (cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Sydney",
  });
};

/** GST-compliant Australian tax invoice as a PDF Buffer. */
export async function generateTaxInvoicePdf(
  opts: ReceiptOptions,
): Promise<Buffer> {
  const currency = opts.currency ?? "AUD";
  const gstCents = Math.round(opts.totalCents / 11); // 10% GST, price inclusive
  const exGstCents = opts.totalCents - gstCents;

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 portrait
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const pink = rgb(0.886, 0.204, 0.502);
  const ink = rgb(0.09, 0.067, 0.078);
  const grey = rgb(0.42, 0.42, 0.42);
  const M = 50;
  const right = width - M;

  const draw = (
    t: string,
    x: number,
    y: number,
    o: { size?: number; f?: typeof font; color?: typeof ink } = {},
  ) => page.drawText(t, { x, y, size: o.size ?? 10, font: o.f ?? font, color: o.color ?? ink });

  const drawRight = (
    t: string,
    xRight: number,
    y: number,
    o: { size?: number; f?: typeof font; color?: typeof ink } = {},
  ) => {
    const size = o.size ?? 10;
    const f = o.f ?? font;
    draw(t, xRight - f.widthOfTextAtSize(t, size), y, o);
  };

  // Pink header band
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: pink });
  draw("TAX INVOICE", M, height - 45, { size: 22, f: bold, color: rgb(1, 1, 1) });
  draw("Dance Teacher Expo 2027", M, height - 68, {
    size: 11,
    color: rgb(1, 1, 1),
  });

  let y = height - 125;

  // Seller (left) + invoice meta (right)
  draw("FROM", M, y, { size: 8, f: bold, color: grey });
  drawRight("INVOICE", right, y, { size: 8, f: bold, color: grey });
  y -= 16;
  draw(SELLER_NAME, M, y, { size: 11, f: bold });
  drawRight(opts.orderNumber, right, y, { size: 11, f: bold });
  y -= 15;
  draw(`ABN ${SELLER_ABN}`, M, y, { color: grey });
  drawRight(`Date: ${formatDate(opts.dateISO)}`, right, y, { color: grey });
  y -= 14;
  draw(SELLER_CONTACT, M, y, { color: grey });

  y -= 34;
  draw("BILL TO", M, y, { size: 8, f: bold, color: grey });
  y -= 16;
  if (opts.buyerName) {
    draw(opts.buyerName, M, y, { size: 11, f: bold });
    y -= 15;
  }
  draw(opts.buyerEmail, M, y, { color: grey });

  // Table header
  y -= 40;
  page.drawLine({
    start: { x: M, y: y + 14 },
    end: { x: right, y: y + 14 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  draw("DESCRIPTION", M, y, { size: 8, f: bold, color: grey });
  drawRight("AMOUNT (AUD)", right, y, { size: 8, f: bold, color: grey });
  y -= 8;
  page.drawLine({
    start: { x: M, y },
    end: { x: right, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });

  // Line items
  y -= 22;
  for (const line of opts.lines) {
    draw(line.description, M, y, { size: 10 });
    drawRight(money(line.amountCents), right, y, { size: 10 });
    y -= 20;
  }

  // Totals
  y -= 6;
  page.drawLine({
    start: { x: width / 2, y: y + 12 },
    end: { x: right, y: y + 12 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  const labelX = width / 2;
  draw("Subtotal (ex GST)", labelX, y, { color: grey });
  drawRight(money(exGstCents), right, y, {});
  y -= 18;
  draw("GST (10%)", labelX, y, { color: grey });
  drawRight(money(gstCents), right, y, {});
  y -= 22;
  page.drawRectangle({
    x: labelX - 6,
    y: y - 6,
    width: right - labelX + 12,
    height: 26,
    color: rgb(0.98, 0.93, 0.95),
  });
  draw("Total (incl. GST)", labelX, y, { size: 11, f: bold });
  drawRight(`${money(opts.totalCents)} ${currency}`, right, y, {
    size: 11,
    f: bold,
    color: pink,
  });

  // Footer
  draw(
    "This document is a tax invoice. Total includes GST of " +
      money(gstCents) +
      ". All amounts in AUD.",
    M,
    70,
    { size: 8, color: grey },
  );
  draw(
    `${SELLER_NAME} · ABN ${SELLER_ABN} · Dance Teacher Expo 2027, Grand Pavilion, Rosehill Gardens, Sydney`,
    M,
    56,
    { size: 8, color: grey },
  );

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
