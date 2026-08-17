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
  const appUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://dance-teacher-expo.vercel.app";
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
            <td style="color:#4b3f45;font-weight:700">${opts.totalCents === 0 ? "Complimentary" : "Total paid"}</td>
            <td style="text-align:right;color:#171114;font-weight:800;font-size:16px">${opts.totalCents === 0 ? "$0.00 AUD" : `${formatAud(opts.totalCents)} AUD`}</td>
          </tr></table>
          ${opts.receiptPdf ? `<div style="color:#8a7a82;font-size:12px;margin-top:6px">Includes GST. Your tax invoice is attached as a PDF.</div>` : ""}
        </div>
        <div style="margin:22px 0 0;text-align:center">
          <a href="${appUrl}/account" style="display:inline-block;background:#171114;color:#ffffff;text-decoration:none;font-weight:800;font-size:13px;letter-spacing:.06em;text-transform:uppercase;padding:13px 26px;border-radius:999px">
            Manage your tickets
          </a>
          <p style="margin:12px 0 0;color:#8a7a82;font-size:13px;line-height:1.6">
            Sign in with this email to add or swap your attendees anytime — everyone needs their own email to access the event app.
          </p>
        </div>
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

/**
 * Sign-in link email, sent by our Supabase "send email" auth hook so we
 * control the content. Admins get admin-oriented copy; buyers get the
 * ticket-management copy. No images (deliverability), visible fallback URL.
 */
export async function sendAuthSignInEmail(opts: {
  to: string;
  actionUrl: string;
  isAdmin: boolean;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "RESEND_API_KEY not set" };

  const from =
    process.env.RESEND_FROM_EMAIL ||
    "Dance Teacher Expo <tickets@updates.danceteacherexpo.com.au>";
  const resend = new Resend(key);

  const copy = opts.isAdmin
    ? {
        eyebrow: "DTE 2027 · Admin",
        heading: "Admin sign-in",
        intro:
          "Tap the button below to sign in to the Dance Teacher Expo 2027 admin dashboard. This link works once and expires shortly.",
        button: "Open the admin dashboard",
      }
    : {
        eyebrow: "Dance Teacher Expo 2027",
        heading: "Your sign-in link",
        intro:
          "Tap the button below to sign in and manage your tickets — you can add or swap your attendees anytime. This link works once and expires shortly.",
        button: "Sign in to your tickets",
      };

  const url = escapeHtml(opts.actionUrl);
  const html = `
  <div style="background:#fff6fa;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #f0e0e8">
      <div style="background:#e23480;padding:22px 28px">
        <div style="color:#ffd3e4;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase">${copy.eyebrow}</div>
        <div style="color:#ffffff;font-size:20px;font-weight:800;margin-top:3px">${copy.heading}</div>
      </div>
      <div style="padding:26px 28px">
        <p style="margin:0 0 16px;color:#4b3f45;line-height:1.6;font-size:15px">${copy.intro}</p>
        <p style="margin:0 0 20px;text-align:center">
          <a href="${url}" style="display:inline-block;background:#e23480;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;letter-spacing:.04em;padding:14px 30px;border-radius:999px">${copy.button}</a>
        </p>
        <p style="margin:0 0 6px;color:#8a7a82;font-size:12px;line-height:1.6">Or paste this link into your browser:</p>
        <p style="margin:0;word-break:break-all;font-size:12px"><a href="${url}" style="color:#e23480">${url}</a></p>
        <p style="margin:18px 0 0;color:#b3a6ac;font-size:12px;line-height:1.6">Didn't request this? You can safely ignore this email.</p>
      </div>
      <div style="padding:16px 28px;border-top:1px solid #f0e0e8;color:#b3a6ac;font-size:11px;line-height:1.6">
        Sat 17 &amp; Sun 18 April 2027 · Grand Pavilion, Rosehill Gardens, Sydney<br/>
        Dance Teacher Expo · ABN 17 611 514 580
      </div>
    </div>
  </div>`;

  try {
    await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.isAdmin
        ? "Your DTE 2027 admin sign-in link"
        : "Your DTE 2027 sign-in link",
      html,
    });
    return { sent: true };
  } catch (e) {
    console.error("[email] auth sign-in send failed", e);
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
