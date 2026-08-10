"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TicketType } from "@/lib/types";
import {
  formatAud,
  priceBreakdown,
  unitPriceCentsForQty,
} from "@/lib/pricing";

type Props = {
  ticketTypes: TicketType[];
};

function tierHint(tt: TicketType): string | null {
  const tiers = [...(tt.pricing_rules?.per_person_tiers ?? [])].sort(
    (a, b) => a.min_qty - b.min_qty,
  );
  if (tiers.length < 2) return null;
  return tiers
    .map((t, i) => {
      const next = tiers[i + 1];
      const range = next
        ? t.min_qty === next.min_qty - 1
          ? `${t.min_qty}`
          : `${t.min_qty}–${next.min_qty - 1}`
        : `${t.min_qty}+`;
      return `${range}: ${formatAud(t.price_cents)}pp`;
    })
    .join("  ·  ");
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function offerHint(tt: TicketType): string | null {
  const rules = tt.pricing_rules ?? {};

  const bands = rules.price_bands;
  if (bands && bands.length > 0) {
    const parts: string[] = [];
    const freeBand = bands.find((b) => b.price_cents === 0);
    if (freeBand && freeBand.from > 1) {
      parts.push(`Buy ${freeBand.from - 1}, get the ${ordinal(freeBand.from)} free`);
    }
    for (const b of bands) {
      if (b.price_cents > 0 && b.price_cents < tt.price_cents) {
        parts.push(`${b.from}+ tickets ${formatAud(b.price_cents)} each`);
      }
    }
    return parts.length ? parts.join("  ·  ") : null;
  }

  const rule = rules.buy_x_get_y;
  if (rule && rule.buy > 0 && rule.free > 0) {
    return `Buy ${rule.buy}, get ${rule.free} free`;
  }
  return null;
}

export function TicketSelector({ ticketTypes }: Props) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      ticketTypes.map((tt) => [tt.id, tt.is_featured ? tt.min_quantity : 0]),
    ),
  );

  const setQty = (tt: TicketType, next: number) => {
    const min = 0;
    const max = tt.max_quantity ?? 99;
    const clamped = Math.max(min, Math.min(max, next));
    setQuantities((q) => ({ ...q, [tt.id]: clamped }));
  };

  const summary = useMemo(() => {
    let totalQty = 0;
    let subtotalCents = 0;
    let savingsCents = 0;
    for (const tt of ticketTypes) {
      const b = priceBreakdown(tt, quantities[tt.id] ?? 0);
      totalQty += b.quantity;
      subtotalCents += b.subtotalCents;
      savingsCents += b.savingsCents;
    }
    return { totalQty, subtotalCents, savingsCents };
  }, [ticketTypes, quantities]);

  const canContinue = summary.totalQty > 0;

  const onContinue = () => {
    const items = ticketTypes
      .map((tt) => [tt.key, quantities[tt.id] ?? 0] as const)
      .filter(([, qty]) => qty > 0)
      .map(([key, qty]) => `${key}:${qty}`)
      .join(",");
    if (!items) return;
    router.push(`/checkout?items=${encodeURIComponent(items)}`);
  };

  return (
    <>
      <div className="mx-auto grid w-full max-w-[560px] gap-5">
        {ticketTypes.map((tt) => {
          const qty = quantities[tt.id] ?? 0;
          const unit = unitPriceCentsForQty(tt, Math.max(1, qty));
          const b = priceBreakdown(tt, qty);
          const hint = offerHint(tt) ?? tierHint(tt);
          return (
            <article
              key={tt.id}
              className="relative overflow-hidden rounded-[14px] border border-black/10 bg-white p-6 shadow-[0_18px_44px_rgba(226,52,128,0.12)]"
            >
              <span className="absolute inset-x-0 top-0 h-[5px] bg-pink" />
              {tt.is_featured && (
                <span className="mb-3 inline-block rounded-full bg-pink px-3 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-white">
                  Most popular
                </span>
              )}
              <h3 className="display text-[1.7rem] text-ink">{tt.name}</h3>

              <div className="mt-2 flex items-end gap-1">
                <span className="display text-[2.8rem] leading-[0.9] text-ink">
                  {formatAud(unit)}
                </span>
                <span className="mb-1.5 text-[0.8rem] font-semibold text-ink/55">
                  per person
                </span>
              </div>
              {hint && (
                <p className="mt-1 text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-pink">
                  {hint}
                </p>
              )}

              {tt.description && (
                <p className="mt-3 text-[0.9rem] leading-relaxed text-ink/70">
                  {tt.description}
                </p>
              )}

              {tt.inclusions.length > 0 && (
                <ul className="mt-4 grid gap-2 text-[0.9rem] text-ink/75">
                  {tt.inclusions.map((inc) => (
                    <li key={inc} className="relative pl-5">
                      <span className="absolute left-0 top-[0.5em] h-[7px] w-[7px] rounded-full bg-pink" />
                      {inc}
                    </li>
                  ))}
                </ul>
              )}

              {/* Quantity stepper */}
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-black/10 pt-4">
                <span className="text-[0.78rem] font-extrabold uppercase tracking-[0.1em] text-ink/60">
                  Attendees
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={`Remove one ${tt.name} ticket`}
                    onClick={() => setQty(tt, qty - 1)}
                    disabled={qty <= 0}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink/20 text-xl font-bold text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    &minus;
                  </button>
                  <span
                    aria-live="polite"
                    className="min-w-[2ch] text-center text-xl font-extrabold tabular-nums text-ink"
                  >
                    {qty}
                  </span>
                  <button
                    type="button"
                    aria-label={`Add one ${tt.name} ticket`}
                    onClick={() => setQty(tt, qty + 1)}
                    disabled={tt.max_quantity != null && qty >= tt.max_quantity}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-pink text-xl font-bold text-white transition-colors hover:bg-pink-hot disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>

              {qty > 0 && (
                <div className="mt-3 flex items-start justify-between gap-3 text-[0.9rem]">
                  <span className="flex flex-wrap gap-x-2 text-ink/60">
                    {b.segments.map((s, i) => (
                      <span
                        key={i}
                        className={s.unitPriceCents === 0 ? "font-bold text-pink" : ""}
                      >
                        {s.unitPriceCents === 0
                          ? `${s.count} free`
                          : `${s.count} × ${formatAud(s.unitPriceCents)}`}
                        {i < b.segments.length - 1 ? " ·" : ""}
                      </span>
                    ))}
                  </span>
                  <span className="whitespace-nowrap font-extrabold text-ink">
                    {formatAud(b.subtotalCents)}
                  </span>
                </div>
              )}
              {b.savingsCents > 0 && (
                <p className="mt-1 text-right text-[0.8rem] font-bold text-pink">
                  You save {formatAud(b.savingsCents)}
                </p>
              )}
            </article>
          );
        })}
      </div>

      {/* Sticky summary bar */}
      <div className="pointer-events-none sticky bottom-0 z-40 mt-6">
        <div className="pointer-events-auto mx-auto flex w-[min(1140px,92vw)] max-w-[560px] items-center justify-between gap-3 rounded-t-[16px] border border-b-0 border-white/10 bg-ink px-5 py-4 shadow-[0_-12px_40px_rgba(0,0,0,0.45)]">
          <div>
            <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-ballet">
              {summary.totalQty === 0
                ? "No tickets yet"
                : `${summary.totalQty} attendee${summary.totalQty === 1 ? "" : "s"}`}
            </div>
            <div className="display text-[1.6rem] leading-none text-white">
              {formatAud(summary.subtotalCents)}
            </div>
            {summary.savingsCents > 0 && (
              <div className="text-[0.72rem] font-bold text-pink-hot">
                Saving {formatAud(summary.savingsCents)}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className="inline-flex items-center rounded-full bg-pink px-6 py-3.5 text-[0.82rem] font-extrabold uppercase tracking-[0.08em] text-white transition-all hover:bg-pink-hot disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      </div>
    </>
  );
}
