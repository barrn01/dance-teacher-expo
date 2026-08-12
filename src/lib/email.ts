import "server-only";
import { Resend } from "resend";
import { qrPngBuffer } from "./qr";
import { formatAud } from "./pricing";

export type TicketForEmail = {
  attendeeName: string;
  ticketTypeName: string;
  qrToken: string;
};

type SendResult = { sent: boolean; reason?: string };

/**
 * Order confirmation with an inline QR ticket per attendee and the tax invoice
 * attached. No-op (returns sent:false) when RESEND_API_KEY is unset, so
 * fulfillment never blocks on email config. QR codes are sent as inline (CID)
 * attachments because Gmail and others block data: URIs.
 */
export async function sendOrderConfirmation(opts: {
  to: string;
  buyerName?: string | null;
  orderNumber: string;
  eventName: string;
  totalCents: number;
  tickets: TicketForEmail[];
  receiptPdf?: { filename: string; content: Buffer };
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "RESEND_API_KEY not set" };

  const from =
    process.env.RESEND_FROM_EMAIL ||
    "Dance Teacher Expo <tickets@updates.danceteacherexpo.com.au>";
  // Replies go to the monitored inbox (GHL), not the send-only subdomain.
  const replyTo = process.env.RESEND_REPLY_TO || undefined;
  const resend = new Resend(key);

  // One inline QR attachment per ticket, referenced by cid in the HTML.
  const qrAttachments = await Promise.all(
    opts.tickets.map(async (t, i) => ({
      filename: `ticket-${i + 1}-${t.qrToken.slice(0, 8)}.png`,
      content: await qrPngBuffer(t.qrToken),
      contentId: `qr-${t.qrToken}`,
    })),
  );

  const ticketRows = opts.tickets
    .map(
      (t) => `
      <tr>
        <td style="padding:14px 16px;border:1px solid #f0e0e8;border-radius:12px 0 0 12px;vertical-align:middle">
          <div style="font-weight:700;font-size:16px;color:#171114">${escapeHtml(t.attendeeName)}</div>
          <div style="color:#8a7a82;font-size:13px;margin-top:2px">${escapeHtml(t.ticketTypeName)}</div>
          <div style="color:#b3a6ac;font-size:11px;margin-top:6px;letter-spacing:.04em">Ticket ${escapeHtml(t.qrToken.slice(0, 8).toUpperCase())}</div>
        </td>
        <td style="padding:10px 14px;border:1px solid #f0e0e8;border-left:0;border-radius:0 12px 12px 0;text-align:right;width:104px;background:#fffafc">
          <img src="cid:qr-${t.qrToken}" width="88" height="88" alt="QR ticket" style="display:block;margin-left:auto" />
        </td>
      </tr>
      <tr><td colspan="2" style="height:10px;line-height:10px">&nbsp;</td></tr>`,
    )
    .join("");

  const html = `
  <div style="background:#fff6fa;padding:24px 0;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #f0e0e8">
      <div style="background:#e23480;padding:26px 28px">
        <div style="color:#ffd3e4;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">You're going to</div>
        <div style="color:#ffffff;font-size:24px;font-weight:800;margin-top:4px">Dance Teacher Expo 2027</div>
      </div>
      <div style="padding:26px 28px">
        <p style="margin:0 0 6px;color:#171114">Hi ${escapeHtml(opts.buyerName || "there")},</p>
        <p style="margin:0 0 20px;color:#4b3f45;line-height:1.6">
          Thanks for your order — that's <b>${opts.tickets.length} ticket${opts.tickets.length === 1 ? "" : "s"}</b> confirmed.
          Show each QR code at the door. Order <b>${escapeHtml(opts.orderNumber)}</b>.
        </p>
        <table style="width:100%;border-collapse:separate;border-spacing:0">${ticketRows}</table>
        <div style="margin-top:8px;padding:16px 18px;background:#fff6fa;border-radius:12px">
          <table style="width:100%"><tr>
            <td style="color:#4b3f45;font-weight:700">Total paid</td>
            <td style="text-align:right;color:#171114;font-weight:800;font-size:16px">${formatAud(opts.totalCents)} AUD</td>
          </tr></table>
          <div style="color:#8a7a82;font-size:12px;margin-top:6px">Includes GST. Your tax invoice is attached as a PDF.</div>
        </div>
        <p style="margin:22px 0 0;color:#8a7a82;font-size:13px;line-height:1.6">
          Bringing a team and haven't added their details yet? We'll email you a link to add each attendee before the expo — everyone needs their own email to access the event app.
        </p>
      </div>
      <div style="padding:18px 28px;border-top:1px solid #f0e0e8;color:#b3a6ac;font-size:12px;line-height:1.6">
        Sat 17 &amp; Sun 18 April 2027 · Grand Pavilion, Rosehill Gardens, Sydney<br/>
        Dance Teacher Expo · ABN 17 611 514 580
      </div>
    </div>
  </div>`;

  const attachments: {
    filename: string;
    content: Buffer;
    contentId?: string;
  }[] = [...qrAttachments];
  if (opts.receiptPdf) {
    attachments.push({
      filename: opts.receiptPdf.filename,
      content: opts.receiptPdf.content,
    });
  }

  try {
    await resend.emails.send({
      from,
      to: opts.to,
      ...(replyTo ? { replyTo } : {}),
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
