import { NextResponse } from "next/server";
import { upsertVendorFromDeposit, tierFromTags } from "@/lib/vendors";

export const runtime = "nodejs";

/**
 * Inbound webhook from GoHighLevel: when a vendor pays their 2027 deposit, the
 * GHL workflow POSTs here and we create/update the vendor on the platform.
 * Secured by a shared secret (header `x-webhook-secret` or `?token=`).
 * Field names are matched flexibly so the GHL body can use its native keys.
 */
type Body = Record<string, unknown>;

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

function pick(body: Body, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = str(body[k]);
    if (v) return v;
  }
  return undefined;
}

export async function POST(request: Request) {
  const secret = process.env.GHL_INBOUND_SECRET;
  if (!secret) {
    console.error("[intake] GHL_INBOUND_SECRET not set");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const provided =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("token") ??
    "";
  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const companyName = pick(body, [
    "company_name",
    "companyName",
    "company",
    "business_name",
  ]);
  const contactEmail = pick(body, ["email", "contact_email", "contactEmail"]);
  const contactName =
    pick(body, ["name", "contact_name", "contactName", "full_name"]) ??
    ([
      pick(body, ["first_name", "firstName"]),
      pick(body, ["last_name", "lastName"]),
    ]
      .filter(Boolean)
      .join(" ") || undefined);
  const contactPhone = pick(body, ["phone", "contact_phone", "contactPhone"]);
  const tier =
    pick(body, ["tier", "package_tier", "sponsorship_tier"])?.toLowerCase() ??
    tierFromTags((body.tags as string[] | string) ?? null) ??
    undefined;
  const family = pick(body, ["family", "package_family", "vendor_type"]);

  if (!companyName || !contactEmail) {
    return NextResponse.json(
      { error: "company name and email are required" },
      { status: 400 },
    );
  }

  const result = await upsertVendorFromDeposit({
    companyName,
    contactEmail,
    contactName: contactName ?? null,
    contactPhone: contactPhone ?? null,
    tier: tier ?? null,
    family: family ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({
    ok: true,
    created: result.created,
    vendorId: result.vendorId,
  });
}
