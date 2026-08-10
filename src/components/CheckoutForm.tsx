"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { formatAud } from "@/lib/pricing";

export type CheckoutSummary = {
  lines: {
    name: string;
    quantity: number;
    segments: { count: number; unitPriceCents: number }[];
    subtotalCents: number;
  }[];
  totalQuantity: number;
  totalCents: number;
  savingsCents: number;
  currency: string;
};

type Props = {
  publishableKey: string | null;
  itemsParam: string;
  summary: CheckoutSummary;
};

type Attendee = { firstName: string; lastName: string; email: string };

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function OrderSummary({ summary }: { summary: CheckoutSummary }) {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-black/10 bg-white p-6">
      <span className="absolute inset-x-0 top-0 h-[5px] bg-pink" />
      <h2 className="text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
        Order summary
      </h2>
      <ul className="mt-4 grid gap-3">
        {summary.lines.map((l) => (
          <li
            key={l.name}
            className="flex items-baseline justify-between gap-3 border-b border-black/5 pb-3 last:border-0"
          >
            <span>
              <span className="font-bold text-ink">{l.name}</span>
              <span className="block text-[0.82rem] text-ink/55">
                {l.segments
                  .map((s) =>
                    s.unitPriceCents === 0
                      ? `${s.count} free`
                      : `${s.count} × ${formatAud(s.unitPriceCents)}`,
                  )
                  .join(" · ")}
              </span>
            </span>
            <span className="font-extrabold text-ink">
              {formatAud(l.subtotalCents)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between border-t border-black/10 pt-4">
        <span className="text-[0.9rem] font-bold uppercase tracking-[0.08em] text-ink/60">
          Total · {summary.totalQuantity} attendee
          {summary.totalQuantity === 1 ? "" : "s"}
        </span>
        <span className="display text-[2rem] leading-none text-ink">
          {formatAud(summary.totalCents)}
        </span>
      </div>
      {summary.savingsCents > 0 && (
        <p className="mt-1 text-right text-[0.82rem] font-bold text-pink">
          You saved {formatAud(summary.savingsCents)}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-[10px] border border-black/15 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-pink";

function PaymentForm({ itemsParam, summary }: Omit<Props, "publishableKey">) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "" });
  const [attendees, setAttendees] = useState<Attendee[]>(() =>
    Array.from({ length: summary.totalQuantity }, () => ({
      firstName: "",
      lastName: "",
      email: "",
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setAttendee = (i: number, patch: Partial<Attendee>) =>
    setAttendees((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    );

  const copyBuyerToFirst = () => {
    const [firstName, ...rest] = buyer.name.trim().split(" ");
    setAttendee(0, {
      firstName: firstName ?? "",
      lastName: rest.join(" "),
      email: buyer.email,
    });
  };

  const validate = (): string | null => {
    if (!buyer.name.trim()) return "Please enter your name.";
    if (!isEmail(buyer.email)) return "Please enter a valid email.";
    for (let i = 0; i < attendees.length; i++) {
      if (!attendees[i].firstName.trim()) {
        return `Please enter a first name for attendee ${i + 1}.`;
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!stripe || !elements) return;

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setSubmitting(true);

    // Validate the Payment Element before creating the intent.
    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setError(submitErr.message ?? "Please check your card details.");
      setSubmitting(false);
      return;
    }

    let clientSecret: string;
    let orderNumber: string;
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsParam, buyer, attendees }),
      });
      const data = await res.json();
      if (!res.ok || !data.clientSecret) {
        setError(data.error ?? "Could not start payment.");
        setSubmitting(false);
        return;
      }
      clientSecret = data.clientSecret;
      orderNumber = data.orderNumber;
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
      return;
    }

    const { error: confirmErr, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success`,
      },
      redirect: "if_required",
    });

    if (confirmErr) {
      setError(confirmErr.message ?? "Payment failed. Please try again.");
      setSubmitting(false);
      return;
    }

    const params = new URLSearchParams({ order: orderNumber });
    if (paymentIntent?.id) params.set("payment_intent", paymentIntent.id);
    router.push(`/checkout/success?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <OrderSummary summary={summary} />

      {/* Buyer */}
      <fieldset className="grid gap-3 rounded-[14px] border border-black/10 bg-white p-6">
        <legend className="px-1 text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
          Your details
        </legend>
        <input
          className={inputClass}
          placeholder="Full name"
          autoComplete="name"
          value={buyer.name}
          onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="Email — your tickets go here"
          type="email"
          autoComplete="email"
          value={buyer.email}
          onChange={(e) => setBuyer({ ...buyer, email: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="Phone (optional)"
          type="tel"
          autoComplete="tel"
          value={buyer.phone}
          onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })}
        />
      </fieldset>

      {/* Attendees */}
      <fieldset className="grid gap-4 rounded-[14px] border border-black/10 bg-white p-6">
        <legend className="px-1 text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
          Who&apos;s coming ({attendees.length})
        </legend>
        {attendees.map((a, i) => (
          <div key={i} className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[0.8rem] font-bold text-ink/70">
                Attendee {i + 1}
              </span>
              {i === 0 && (
                <button
                  type="button"
                  onClick={copyBuyerToFirst}
                  className="text-[0.72rem] font-bold uppercase tracking-[0.06em] text-pink hover:text-pink-hot"
                >
                  Same as me
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className={inputClass}
                placeholder="First name"
                value={a.firstName}
                onChange={(e) => setAttendee(i, { firstName: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Last name"
                value={a.lastName}
                onChange={(e) => setAttendee(i, { lastName: e.target.value })}
              />
            </div>
            <input
              className={inputClass}
              placeholder="Email (optional)"
              type="email"
              value={a.email}
              onChange={(e) => setAttendee(i, { email: e.target.value })}
            />
          </div>
        ))}
      </fieldset>

      {/* Payment */}
      <fieldset className="grid gap-3 rounded-[14px] border border-black/10 bg-white p-6">
        <legend className="px-1 text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
          Payment
        </legend>
        <PaymentElement />
      </fieldset>

      {error && (
        <p className="rounded-[10px] bg-pink/10 px-4 py-3 text-[0.9rem] font-semibold text-pink">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="inline-flex items-center justify-center rounded-full bg-pink px-8 py-4 text-[0.9rem] font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:bg-pink-hot disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Processing…" : `Pay ${formatAud(summary.totalCents)}`}
      </button>
      <p className="text-center text-[0.75rem] text-ink/45">
        Secure payment by Stripe. Card details are entered directly with Stripe
        and never touch our servers.
      </p>
    </form>
  );
}

export function CheckoutForm({ publishableKey, itemsParam, summary }: Props) {
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  if (!stripePromise) {
    return (
      <div className="grid gap-6">
        <OrderSummary summary={summary} />
        <div className="rounded-[14px] border border-dashed border-pink/40 bg-paper-2 p-6 text-center">
          <p className="text-[0.9rem] font-bold text-ink">
            Card payment isn&apos;t enabled in this environment.
          </p>
          <p className="mt-2 text-[0.85rem] leading-relaxed text-ink/65">
            Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable checkout here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        mode: "payment",
        amount: summary.totalCents,
        currency: summary.currency.toLowerCase(),
        appearance: {
          theme: "flat",
          variables: {
            colorPrimary: "#e23480",
            colorText: "#171114",
            borderRadius: "10px",
            fontFamily: "Montserrat, system-ui, sans-serif",
          },
        },
      }}
    >
      <PaymentForm itemsParam={itemsParam} summary={summary} />
    </Elements>
  );
}
