import "server-only";
import { createServiceClient } from "../supabase/server";
import { TIER_PRICE_EX_GST, TIER_LABEL, type Tier } from "../vendors";
import type { Vendor } from "../types";
import { xeroFetch } from "./client";
import {
  TIER_ITEM_CODE,
  REVENUE_ACCOUNT_CODE,
  GST_OUTPUT_TAX_TYPE,
  LINE_AMOUNT_TYPE,
  DEPOSIT_LINE,
  ROUNDING_LINE,
} from "./config";

/** YYYY-MM-DD in the org timezone (Australia/Sydney) for invoice dates. */
function sydneyDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  // en-CA gives YYYY-MM-DD; timeZone keeps us on the Sydney calendar day.
  return d.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
}

type XeroContact = { ContactID: string; Name: string; EmailAddress?: string };

async function findContactByEmail(email: string): Promise<XeroContact | null> {
  const where = encodeURIComponent(`EmailAddress=="${email.replace(/"/g, "")}"`);
  const data = await xeroFetch<{ Contacts?: XeroContact[] }>(
    `/Contacts?where=${where}`,
  );
  return data.Contacts?.[0] ?? null;
}

async function findContactByName(name: string): Promise<XeroContact | null> {
  const where = encodeURIComponent(`Name=="${name.replace(/"/g, "")}"`);
  const data = await xeroFetch<{ Contacts?: XeroContact[] }>(
    `/Contacts?where=${where}`,
  );
  return data.Contacts?.[0] ?? null;
}

/** Find the vendor's Xero contact by email, then exact name, else create one. */
export async function findOrCreateContact(vendor: Vendor): Promise<string> {
  const byEmail = vendor.contact_email
    ? await findContactByEmail(vendor.contact_email)
    : null;
  if (byEmail) return byEmail.ContactID;

  const byName = await findContactByName(vendor.company_name);
  if (byName) return byName.ContactID;

  const [firstName, ...rest] = (vendor.contact_name ?? "").trim().split(/\s+/);
  const created = await xeroFetch<{ Contacts: XeroContact[] }>("/Contacts", {
    method: "POST",
    body: JSON.stringify({
      Contacts: [
        {
          Name: vendor.company_name,
          EmailAddress: vendor.contact_email || undefined,
          FirstName: firstName || undefined,
          LastName: rest.join(" ") || undefined,
        },
      ],
    }),
  });
  const id = created.Contacts?.[0]?.ContactID;
  if (!id) throw new Error("Xero did not return a contact id.");
  return id;
}

type BrandingTheme = { BrandingThemeID: string; Name: string };

/**
 * The DTE branding theme id (logo, bank details, pay-online + card methods).
 * Prefers the explicit env var; otherwise matches a theme whose name looks like
 * Dance Teacher Expo / DTE. Returns undefined to let Xero use the org default.
 * Memoised per server instance so a bulk run doesn't re-fetch it each invoice.
 */
let brandingThemeCache: string | undefined;
let brandingThemeResolved = false;
export async function resolveBrandingThemeId(): Promise<string | undefined> {
  const fromEnv = process.env.XERO_BRANDING_THEME_ID?.trim();
  if (fromEnv) return fromEnv;
  if (brandingThemeResolved) return brandingThemeCache;
  try {
    const data = await xeroFetch<{ BrandingThemes?: BrandingTheme[] }>(
      "/BrandingThemes",
    );
    const match = data.BrandingThemes?.find((t) =>
      /dance teacher expo|dte/i.test(t.Name),
    );
    brandingThemeCache = match?.BrandingThemeID;
    brandingThemeResolved = true;
    return brandingThemeCache;
  } catch {
    return undefined;
  }
}

/** Branding themes for the admin connect screen (so Nathan can pick/confirm). */
export async function listBrandingThemes(): Promise<BrandingTheme[]> {
  const data = await xeroFetch<{ BrandingThemes?: BrandingTheme[] }>(
    "/BrandingThemes",
  );
  return data.BrandingThemes ?? [];
}

export type XeroInvoiceResult =
  | {
      ok: true;
      invoiceId: string;
      invoiceNumber: string | null;
      status: string;
      amountDue: number;
    }
  | { ok: false; error: string };

/**
 * Create (or re-create) the DRAFT vendor invoice in Xero and record it on the
 * vendor row. Idempotent: skips if the vendor already has a xero_invoice_id
 * unless `force` is set. Requires a package tier (the item line needs a code).
 * Never throws — returns a typed result so callers (webhook / button) can log.
 */
export async function createDraftInvoiceForVendor(
  vendorId: string,
  opts: { force?: boolean } = {},
): Promise<XeroInvoiceResult> {
  const sb = createServiceClient();
  const { data: vendor } = await sb
    .from("vendors")
    .select("*")
    .eq("id", vendorId)
    .maybeSingle<Vendor>();
  if (!vendor) return { ok: false, error: "Vendor not found." };

  if (vendor.xero_invoice_id && !opts.force) {
    return {
      ok: true,
      invoiceId: vendor.xero_invoice_id,
      invoiceNumber: vendor.xero_invoice_number,
      status: vendor.xero_invoice_status ?? "DRAFT",
      amountDue: 0,
    };
  }

  const tier = vendor.package_tier as Tier | null;
  if (!tier) {
    const error = "Vendor has no package tier — set a tier before invoicing.";
    await sb.from("vendors").update({ xero_last_error: error }).eq("id", vendorId);
    return { ok: false, error };
  }

  try {
    const contactId = vendor.xero_contact_id ?? (await findOrCreateContact(vendor));
    const brandingThemeId = await resolveBrandingThemeId();
    const dueDays = Number(process.env.XERO_INVOICE_DUE_DAYS ?? "30") || 30;

    const payload = {
      Invoices: [
        {
          Type: "ACCREC",
          Contact: { ContactID: contactId },
          Status: "DRAFT",
          LineAmountTypes: LINE_AMOUNT_TYPE,
          Date: sydneyDate(0),
          DueDate: sydneyDate(dueDays),
          ...(brandingThemeId ? { BrandingThemeID: brandingThemeId } : {}),
          Reference: `DTE 2027 ${TIER_LABEL[tier]} Vendor Package`,
          LineItems: [
            {
              ItemCode: TIER_ITEM_CODE[tier],
              Description: `Dance Teacher Expo - ${TIER_LABEL[tier]} Vendor Package`,
              Quantity: 1,
              UnitAmount: TIER_PRICE_EX_GST[tier],
              AccountCode: REVENUE_ACCOUNT_CODE,
              TaxType: GST_OUTPUT_TAX_TYPE,
            },
            {
              Description: DEPOSIT_LINE.description,
              Quantity: 1,
              UnitAmount: DEPOSIT_LINE.unitAmount,
              AccountCode: DEPOSIT_LINE.accountCode,
              TaxType: GST_OUTPUT_TAX_TYPE,
            },
            {
              Description: ROUNDING_LINE.description,
              Quantity: 1,
              UnitAmount: ROUNDING_LINE.unitAmount,
              AccountCode: ROUNDING_LINE.accountCode,
              TaxType: GST_OUTPUT_TAX_TYPE,
            },
          ],
        },
      ],
    };

    const result = await xeroFetch<{
      Invoices: Array<{
        InvoiceID: string;
        InvoiceNumber: string | null;
        Status: string;
        AmountDue: number;
      }>;
    }>("/Invoices", { method: "POST", body: JSON.stringify(payload) });

    const inv = result.Invoices?.[0];
    if (!inv?.InvoiceID) throw new Error("Xero did not return an invoice.");

    await sb
      .from("vendors")
      .update({
        xero_contact_id: contactId,
        xero_invoice_id: inv.InvoiceID,
        xero_invoice_number: inv.InvoiceNumber,
        xero_invoice_status: inv.Status,
        xero_invoiced_at: new Date().toISOString(),
        xero_last_error: null,
      })
      .eq("id", vendorId);

    return {
      ok: true,
      invoiceId: inv.InvoiceID,
      invoiceNumber: inv.InvoiceNumber,
      status: inv.Status,
      amountDue: inv.AmountDue,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Xero invoice failed.";
    console.error("[xero] createDraftInvoiceForVendor failed", error);
    await sb
      .from("vendors")
      .update({ xero_last_error: error.slice(0, 1000) })
      .eq("id", vendorId);
    return { ok: false, error };
  }
}
