import "server-only";
import { Resend } from "resend";
import { qrDataUrl, qrPngBuffer } from "./qr";
import { formatAud } from "./pricing";

export type TicketForEmail = {
  attendeeName: string;
  ticketTypeName: string;
  qrToken: string;
};

type SendResult = { sent: boolean; reason?: string };

/**
 * Order confirmation with a QR ticket per attendee. No-op (returns sent:false)
 * when RESEND_API_KEY is unset, so fulfillment never blocks on email config.
 */
export async function sendOrderConfirmation(opts: {
  to: string;
  buyerName?: string | null;
  orderNumber: string;
  eventName: string;
  totalCents: number;
  tickets: TicketForEmail[];
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "RESEND_API_KEY not set" };

  const from =
    process.env.RESEND_FROM_EMAIL ||
    "Dance Teacher Expo <tickets@danceteacherexpo.com.au>";
  const resend = new Resend(key);

  const ticketBlocks = await Promise.all(
    opts.tickets.map(async (t) => {
      const dataUrl = await qrDataUrl(t.qrToken);
      return `
        <table style="width:100%;border:1px solid #eee;border-radius:12px;margin:0 0 12px">
          <tr>
            <td style="padding:16px;vertical-align:middle">
              <div style="font-weight:700;font-size:16px;color:#171114">${escapeHtml(t.attendeeName)}</div>
              <div style="color:#6b6b6b;font-size:13px">${escapeHtml(t.ticketTypeName)}</div>
              <div style="color:#9b9b9b;font-size:11px;margin-top:6px">Ticket ${escapeHtml(t.qrToken.slice(0, 8))}</div>
            </td>
            <td style="padding:12px;text-align:right;width:120px">
              <img src="${dataUrl}" width="96" height="96" alt="QR ticket" style="display:inline-block" />
            </td>
          </tr>
        </table>`;
    }),
  );

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#171114">
      <h1 style="font-size:22px;margin:0 0 4px">You're going to DTE 2027 🎉</h1>
      <p style="color:#6b6b6b;margin:0 0 20px">Order ${escapeHtml(opts.orderNumber)} · ${escapeHtml(opts.eventName)}</p>
      <p>Hi ${escapeHtml(opts.buyerName || "there")}, thanks for your order — that's ${opts.tickets.length} ticket${opts.tickets.length === 1 ? "" : "s"} confirmed. Show each QR code at the door.</p>
      ${ticketBlocks.join("")}
      <p style="color:#6b6b6b;font-size:13px">Total paid: ${formatAud(opts.totalCents)} AUD (incl. GST)</p>
      <p style="color:#9b9b9b;font-size:12px">Sat 17 &amp; Sun 18 April 2027 · Grand Pavilion, Rosehill Gardens, Sydney</p>
    </div>`;

  const attachments = await Promise.all(
    opts.tickets.map(async (t) => ({
      filename: `ticket-${t.qrToken.slice(0, 8)}.png`,
      content: (await qrPngBuffer(t.qrToken)).toString("base64"),
    })),
  );

  try {
    await resend.emails.send({
      from,
      to: opts.to,
      subject: `Your DTE 2027 tickets — order ${opts.orderNumber}`,
      html,
      attachments,
    });
    return { sent: true };
  } catch (e) {
    console.error("[email] send failed", e);
    return { sent: false, reason: "send error" };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
