import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminGate } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getVendorStaff,
  getVendorDocuments,
  TIER_LABEL,
  FAMILY_LABEL,
  DOC_TYPE_LABEL,
  type Tier,
  type Family,
} from "@/lib/vendors";
import type { Vendor } from "@/lib/types";
import {
  VendorResendButton,
  DocStatusControl,
  VendorRecordForm,
} from "@/components/admin/VendorManager";
import { VendorProfileForm } from "@/components/vendor/VendorProfileForm";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, string> = {
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-pink/15 text-pink",
};

const fmtSize = (b: number | null) =>
  !b ? "" : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;

export default async function AdminVendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return null;

  const { id } = await params;
  const sb = createServiceClient();
  const { data: vendor } = await sb
    .from("vendors")
    .select("*")
    .eq("id", id)
    .maybeSingle<Vendor>();
  if (!vendor) notFound();

  const [staff, docs] = await Promise.all([
    getVendorStaff(vendor.id),
    getVendorDocuments(vendor.id),
  ]);

  const tier = vendor.package_tier
    ? TIER_LABEL[vendor.package_tier as Tier]
    : null;
  const family = vendor.package_family
    ? FAMILY_LABEL[vendor.package_family as Family]
    : null;

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href="/admin/vendors"
          className="text-[0.8rem] font-bold uppercase tracking-[0.06em] text-ink/55 hover:text-ink"
        >
          ← Vendors
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="display text-[clamp(1.6rem,5vw,2.2rem)]">
            {vendor.company_name}
          </h1>
          <VendorResendButton id={vendor.id} />
        </div>
        <p className="mt-1 text-[0.9rem] text-ink/55">
          {[family, tier].filter(Boolean).join(" · ") || "Exhibitor"} ·{" "}
          {vendor.contact_email}
        </p>
      </div>

      {/* Editable vendor record (company, tier, contact, booth, status) */}
      <VendorRecordForm vendor={vendor} />

      {/* Edit their exhibitor listing on their behalf */}
      <VendorProfileForm vendor={vendor} adminVendorId={vendor.id} />

      {/* Documents */}
      <section className="grid gap-3">
        <h2 className="text-[0.8rem] font-extrabold uppercase tracking-[0.12em] text-ink/55">
          Documents ({docs.length})
        </h2>
        {docs.length === 0 ? (
          <p className="rounded-[12px] border border-black/10 bg-white px-4 py-8 text-center text-ink/50">
            No documents uploaded yet.
          </p>
        ) : (
          <div className="grid gap-2">
            {docs.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-black/10 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-ink">
                    {DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}
                    {d.label ? ` — ${d.label}` : ""}
                  </div>
                  <div className="truncate text-[0.8rem] text-ink/55">
                    {d.file_name}
                    {d.size_bytes ? ` · ${fmtSize(d.size_bytes)}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.05em] ${
                      statusStyle[d.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {d.status}
                  </span>
                  {d.signedUrl && (
                    <a
                      href={d.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-black/15 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.04em] text-ink/60 hover:border-ink"
                    >
                      View
                    </a>
                  )}
                  <DocStatusControl id={d.id} status={d.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Staff */}
      <section className="grid gap-3">
        <h2 className="text-[0.8rem] font-extrabold uppercase tracking-[0.12em] text-ink/55">
          Attending staff ({staff.length})
        </h2>
        {staff.length === 0 ? (
          <p className="rounded-[12px] border border-black/10 bg-white px-4 py-8 text-center text-ink/50">
            No staff added yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[12px] border border-black/10 bg-white">
            <table className="w-full min-w-[480px] border-collapse text-[0.9rem]">
              <tbody>
                {staff.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-black/5 last:border-0"
                  >
                    <td className="px-4 py-2.5 font-semibold text-ink">
                      {[s.first_name, s.last_name].filter(Boolean).join(" ") ||
                        "Unnamed"}
                    </td>
                    <td className="px-4 py-2.5 text-ink/60">
                      {s.email || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink/60">
                      {s.phone || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

