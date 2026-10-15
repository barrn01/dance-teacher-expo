import Link from "next/link";
import { getAdminGate } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { getConnection } from "@/lib/xero/client";
import { listBrandingThemes, resolveBrandingThemeId } from "@/lib/xero/invoices";
import { XeroBackfillButton } from "@/components/admin/VendorManager";

export const dynamic = "force-dynamic";

const fmtDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Australia/Sydney",
      })
    : "—";

export default async function AdminXeroPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return null;

  const { connected, error } = await searchParams;
  const conn = await getConnection();
  const configured = Boolean(process.env.XERO_CLIENT_ID);

  // Active, tiered vendors with no Xero invoice yet — the backfill candidates.
  let eligible = 0;
  if (conn) {
    const sb = createServiceClient();
    const { count } = await sb
      .from("vendors")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .is("xero_invoice_id", null)
      .not("package_tier", "is", null);
    eligible = count ?? 0;
  }

  let themes: { BrandingThemeID: string; Name: string }[] = [];
  let activeThemeId: string | undefined;
  if (conn) {
    try {
      [themes, activeThemeId] = await Promise.all([
        listBrandingThemes(),
        resolveBrandingThemeId(),
      ]);
    } catch {
      /* token may have lapsed — the Reconnect button handles it */
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href="/admin"
          className="text-[0.8rem] font-bold uppercase tracking-[0.06em] text-ink/55 hover:text-ink"
        >
          ← Orders
        </Link>
        <h1 className="display mt-2 text-[clamp(1.6rem,5vw,2.2rem)]">
          Xero invoicing
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          When a vendor pays their deposit, a DRAFT invoice is auto-created in
          Xero (package − $500 deposit). Nothing is emailed — it waits in Xero
          for review and sending.
        </p>
      </div>

      {connected && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          Connected to Xero successfully.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          Couldn&apos;t connect to Xero: {decodeURIComponent(error)}
        </p>
      )}

      {!configured && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Xero API keys aren&apos;t set yet. Add{" "}
          <code>XERO_CLIENT_ID</code> and <code>XERO_CLIENT_SECRET</code> in
          Vercel, then redeploy before connecting.
        </p>
      )}

      <section className="rounded-xl border border-ink/10 bg-paper p-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.06em] text-ink/55">
          Connection
        </h2>
        {conn ? (
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink/55">Organisation</dt>
              <dd className="font-medium">{conn.tenant_name ?? conn.tenant_id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink/55">Access token valid until</dt>
              <dd className="font-medium">{fmtDateTime(conn.expires_at)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink/55">Status</dt>
              <dd className="font-medium text-green-700">Connected</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-ink/60">Not connected yet.</p>
        )}

        {configured && (
          <a
            href="/api/xero/connect"
            className="mt-4 inline-flex items-center rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-paper hover:bg-ink/90"
          >
            {conn ? "Reconnect to Xero" : "Connect to Xero"}
          </a>
        )}
      </section>

      {conn && (
        <section className="rounded-xl border border-ink/10 bg-paper p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.06em] text-ink/55">
            Backfill booked vendors
          </h2>
          <p className="mt-1 mb-4 text-xs text-ink/55">
            One-time: create DRAFT invoices for vendors who signed before Xero
            was connected. Each assumes the $500 deposit was paid — review every
            draft in Xero before sending.
          </p>
          <XeroBackfillButton eligible={eligible} />
        </section>
      )}

      {conn && (
        <section className="rounded-xl border border-ink/10 bg-paper p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.06em] text-ink/55">
            Branding theme
          </h2>
          <p className="mt-1 text-xs text-ink/55">
            Invoices use this theme (logo, bank details, pay-online + card
            methods). Set <code>XERO_BRANDING_THEME_ID</code> in Vercel to one of
            these ids to pin it; otherwise the DTE-named theme is auto-matched.
          </p>
          <ul className="mt-3 grid gap-1.5 text-sm">
            {themes.length === 0 && (
              <li className="text-ink/55">No branding themes returned.</li>
            )}
            {themes.map((t) => (
              <li key={t.BrandingThemeID} className="flex justify-between gap-4">
                <span className="font-medium">
                  {t.Name}
                  {t.BrandingThemeID === activeThemeId && (
                    <span className="ml-2 rounded-full bg-pink/15 px-2 py-0.5 text-[0.7rem] font-bold uppercase text-pink">
                      in use
                    </span>
                  )}
                </span>
                <code className="text-xs text-ink/50">{t.BrandingThemeID}</code>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
