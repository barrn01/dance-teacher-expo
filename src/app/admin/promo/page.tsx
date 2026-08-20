import Link from "next/link";
import { getAdminGate } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { promoLabel, type PromoRow } from "@/lib/promo";
import {
  PromoBulkUpload,
  PromoCreateForm,
  PromoToggle,
} from "@/components/admin/PromoManager";

export const dynamic = "force-dynamic";

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Australia/Sydney",
      })
    : "—";

export default async function AdminPromoPage() {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return null;

  const sb = createServiceClient();
  const { data: codes } = await sb
    .from("promo_codes")
    .select(
      "id, code, discount_type, discount_value, max_redemptions, times_redeemed, ends_at, is_active",
    )
    .order("created_at", { ascending: false });

  const rows = (codes ?? []) as (Pick<
    PromoRow,
    | "id"
    | "code"
    | "discount_type"
    | "discount_value"
    | "max_redemptions"
    | "times_redeemed"
    | "ends_at"
    | "is_active"
  >)[];

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
          Promo codes
        </h1>
      </div>

      <PromoCreateForm />

      <PromoBulkUpload />

      <div className="overflow-x-auto rounded-[12px] border border-black/10 bg-white">
        <table className="w-full min-w-[620px] border-collapse text-[0.9rem]">
          <thead>
            <tr className="border-b border-black/10 text-left text-[0.7rem] font-bold uppercase tracking-[0.08em] text-ink/45">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3 text-center">Used</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink/50">
                  No promo codes yet.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-black/5 last:border-0"
                >
                  <td className="px-4 py-3 font-mono font-bold text-ink">
                    {c.code}
                  </td>
                  <td className="px-4 py-3">{promoLabel(c)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {c.times_redeemed}
                    {c.max_redemptions != null ? ` / ${c.max_redemptions}` : ""}
                  </td>
                  <td className="px-4 py-3 text-[0.85rem] text-ink/60">
                    {fmtDate(c.ends_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-[0.04em] ${
                        c.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PromoToggle id={c.id} isActive={c.is_active} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
