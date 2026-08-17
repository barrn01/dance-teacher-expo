"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { refundOrder } from "@/app/admin/actions";
import { formatAud } from "@/lib/pricing";

export function RefundPanel({
  orderId,
  totalCents,
  amountRefundedCents,
  currency,
}: {
  orderId: string;
  totalCents: number;
  amountRefundedCents: number;
  currency: string;
}) {
  const router = useRouter();
  const refundable = totalCents - amountRefundedCents;
  const [dollars, setDollars] = useState((refundable / 100).toFixed(2));
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = Math.round(parseFloat(dollars || "0") * 100);
  const valid = amountCents > 0 && amountCents <= refundable;
  const isFull = amountCents === refundable;

  const doRefund = async () => {
    setBusy(true);
    setError(null);
    const res = await refundOrder({ orderId, amountCents });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Refund failed.");
      setConfirming(false);
      return;
    }
    setConfirming(false);
    router.refresh();
  };

  return (
    <div className="rounded-[12px] border border-black/10 bg-white p-5">
      <h2 className="mb-1 text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
        Refund
      </h2>
      <p className="mb-3 text-[0.82rem] text-ink/55">
        {amountRefundedCents > 0 && (
          <>Already refunded {formatAud(amountRefundedCents)}. </>
        )}
        Refundable: <b>{formatAud(refundable)}</b> {currency}
      </p>

      {!confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-[10px] border border-black/15 bg-white px-3">
            <span className="text-ink/45">$</span>
            <input
              inputMode="decimal"
              value={dollars}
              onChange={(e) => setDollars(e.target.value)}
              className="w-24 bg-transparent px-1.5 py-2 text-[0.95rem] outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setDollars((refundable / 100).toFixed(2))}
            className="rounded-full border border-black/15 px-3 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.04em] text-ink/60 hover:border-ink"
          >
            Full
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => {
              setError(null);
              setConfirming(true);
            }}
            className="rounded-full bg-ink px-5 py-2 text-[0.78rem] font-extrabold uppercase tracking-[0.06em] text-white transition-colors hover:bg-char-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Refund {valid ? formatAud(amountCents) : ""}
          </button>
        </div>
      ) : (
        <div className="rounded-[10px] bg-paper-2 p-3.5">
          <p className="text-[0.9rem] text-ink">
            {isFull ? "Full refund" : "Partial refund"} of{" "}
            <b>
              {formatAud(amountCents)} {currency}
            </b>{" "}
            to the buyer — this goes back on their card and can&apos;t be undone.
            {isFull && " The tickets on this order will be voided."}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={doRefund}
              className="rounded-full bg-pink px-5 py-2 text-[0.78rem] font-extrabold uppercase tracking-[0.06em] text-white transition-colors hover:bg-pink-hot disabled:opacity-50"
            >
              {busy ? "Refunding…" : "Confirm refund"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-ink/55 hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-[10px] bg-pink/10 px-4 py-2.5 text-[0.88rem] font-semibold text-pink">
          {error}
        </p>
      )}
    </div>
  );
}
