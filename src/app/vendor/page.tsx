import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LoginForm } from "@/components/account/LoginForm";
import { SignOutButton } from "@/components/account/SignOutButton";
import { VendorProfileForm } from "@/components/vendor/VendorProfileForm";
import { VendorStaffManager } from "@/components/vendor/VendorStaffManager";
import { VendorDocuments } from "@/components/vendor/VendorDocuments";
import {
  getVendorGate,
  getVendorStaff,
  getVendorDocuments,
  isProfileComplete,
  TIER_LABEL,
  FAMILY_LABEL,
  type Tier,
  type Family,
} from "@/lib/vendors";
import type { Vendor } from "@/lib/types";

export const metadata: Metadata = {
  title: "Exhibitor portal — Dance Teacher Expo 2027",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function VendorPage() {
  const gate = await getVendorGate();

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-paper text-ink">
        <div className="mx-auto w-[min(1140px,92vw)] max-w-[760px] py-[clamp(2.5rem,7vw,4.5rem)]">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-pink">
                Exhibitor portal
              </span>
              <h1 className="display mt-2 text-[clamp(2rem,7vw,3rem)] text-ink">
                {gate.status === "vendor"
                  ? gate.vendor.company_name
                  : "Exhibitors"}
              </h1>
            </div>
            {gate.status !== "anon" && (
              <div className="pt-2 text-right">
                <div className="text-[0.8rem] text-ink/50">
                  {gate.status === "vendor"
                    ? gate.vendor.contact_email
                    : gate.email}
                </div>
                <SignOutButton />
              </div>
            )}
          </div>

          {gate.status === "anon" && (
            <LoginForm
              next="/vendor"
              heading="Exhibitor sign-in"
              intro="Enter the email on your exhibitor booking and we'll send you a sign-in link — no password needed. From there you can complete your listing."
              sentNote="Tap it to open your exhibitor portal."
            />
          )}

          {gate.status === "not_vendor" && (
            <div className="rounded-[14px] border border-black/10 bg-white p-6 text-center">
              <p className="font-bold text-ink">
                We couldn&apos;t find an exhibitor booking for this email
              </p>
              <p className="mx-auto mt-2 max-w-[46ch] text-[0.92rem] leading-relaxed text-ink/65">
                {gate.email} isn&apos;t linked to a Dance Teacher Expo 2027
                exhibitor package. If you booked with a different email, sign in
                with that one — or contact us at{" "}
                <a
                  href="mailto:hello@danceteacherexpo.com.au"
                  className="font-bold text-pink hover:underline"
                >
                  hello@danceteacherexpo.com.au
                </a>
                .
              </p>
              <div className="mt-4">
                <SignOutButton />
              </div>
            </div>
          )}

          {gate.status === "vendor" && (
            <div className="grid gap-6">
              <PackageSummary vendor={gate.vendor} />
              <VendorProfileForm vendor={gate.vendor} />
              <VendorStaffManager staff={await getVendorStaff(gate.vendor.id)} />
              <VendorDocuments docs={await getVendorDocuments(gate.vendor.id)} />
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function PackageSummary({ vendor }: { vendor: Vendor }) {
  const tier = vendor.package_tier
    ? TIER_LABEL[vendor.package_tier as Tier]
    : null;
  const family = vendor.package_family
    ? FAMILY_LABEL[vendor.package_family as Family]
    : null;
  const complete = isProfileComplete(vendor);

  return (
    <section className="relative overflow-hidden rounded-[14px] border border-black/10 bg-white p-6">
      <span className="absolute inset-x-0 top-0 h-[5px] bg-ink/70" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink/45">
            Your package
          </div>
          <div className="display mt-1 text-[clamp(1.4rem,4vw,1.9rem)] text-ink">
            {[family, tier].filter(Boolean).join(" · ") || "Exhibitor"}
          </div>
          {vendor.booth_number && (
            <div className="mt-1 text-[0.85rem] text-ink/60">
              Booth {vendor.booth_number}
            </div>
          )}
        </div>
        <span
          className={`inline-block rounded-full px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.05em] ${
            complete
              ? "bg-green-100 text-green-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {complete ? "Listing complete" : "Listing incomplete"}
        </span>
      </div>
      <p className="mt-3 text-[0.9rem] leading-relaxed text-ink/60">
        Complete your exhibitor listing below — it appears in the event
        directory and app. Full package inclusions are in your vendor
        prospectus; questions? Email{" "}
        <a
          href="mailto:hello@danceteacherexpo.com.au"
          className="font-semibold text-pink hover:underline"
        >
          hello@danceteacherexpo.com.au
        </a>
        .
      </p>
    </section>
  );
}
