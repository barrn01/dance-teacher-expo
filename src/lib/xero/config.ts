import type { Tier } from "../vendors";

/**
 * Xero vendor-invoicing config. Values mirror the existing hand-made invoices
 * (see INV-0218 / INV-0151) so the automated draft matches the bookkeeper's
 * convention exactly: package item line + a fixed -$500 deposit (two lines) on
 * a GST-exclusive invoice coded to revenue account 210.
 */

// Xero item code per tier. Service and Fashion families share these codes.
export const TIER_ITEM_CODE: Record<Tier, string> = {
  bronze: "302",
  silver: "303",
  gold: "304",
  platinum: "305",
};

// Revenue account the package + deposit lines are coded to.
export const REVENUE_ACCOUNT_CODE = "210";
// The 1-cent rounding line goes to its own account (matches INV-0070).
export const ROUNDING_ACCOUNT_CODE = "216";

// AU GST on income, applied exclusively (unit amounts are ex-GST, 10% added).
export const GST_OUTPUT_TAX_TYPE = "OUTPUT";
export const LINE_AMOUNT_TYPE = "Exclusive" as const;

/**
 * The deposit is always shown as two fixed lines that net to exactly -$500 inc
 * GST, regardless of tier:
 *   DTE Vendor Deposit - PAID   -454.54  (ex GST, 10% -> grosses to -499.99)
 *   Rounding                      -0.01  (-> deposit total lands on -500.00)
 */
export const DEPOSIT_LINE = {
  description: "DTE Vendor Deposit - PAID",
  unitAmount: -454.54,
  accountCode: REVENUE_ACCOUNT_CODE,
} as const;
export const ROUNDING_LINE = {
  description: "Rounding",
  unitAmount: -0.01,
  accountCode: ROUNDING_ACCOUNT_CODE,
} as const;

// --- OAuth2 / API ---------------------------------------------------------------
export const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
export const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
export const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";
export const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";

// Canonical Xero scope set. The identity scopes (openid/profile/email) are what
// Xero's own sample apps request; accounting.settings lets us read branding
// themes. offline_access gives us the refresh token.
export const XERO_SCOPES =
  "openid profile email accounting.transactions accounting.contacts accounting.settings offline_access";

/** Redirect URI registered on the Xero app; derived from the site URL. */
export function xeroRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/api/xero/callback`;
}
