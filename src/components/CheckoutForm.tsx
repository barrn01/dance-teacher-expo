"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { formatAud } from "@/lib/pricing";
import { checkPromo } from "@/app/checkout/actions";
import { ATTENDEE_CATEGORIES } from "@/lib/attendee-config";

const CATEGORY_PROMPT = "Which best describes them?";

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

type Attendee = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  category: string;
};

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function OrderSummary({
  summary,
  discountCents = 0,
  promoLabel,
}: {
  summary: CheckoutSummary;
  discountCents?: number;
  promoLabel?: string;
}) {
  const effective = Math.max(0, summary.totalCents - discountCents);
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
      {discountCents > 0 && (
        <div className="mt-3 flex items-center justify-between text-pink">
          <span className="text-[0.85rem] font-bold uppercase tracking-[0.04em]">
            Promo{promoLabel ? ` · ${promoLabel}` : ""}
          </span>
          <span className="font-extrabold">−{formatAud(discountCents)}</span>
        </div>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-black/10 pt-4">
        <span className="text-[0.9rem] font-bold uppercase tracking-[0.08em] text-ink/60">
          Total · {summary.totalQuantity} attendee
          {summary.totalQuantity === 1 ? "" : "s"}
        </span>
        <span className="display text-[2rem] leading-none text-ink">
          {formatAud(effective)}
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
      phone: "",
      category: "",
    })),
  );
  const [deferDetails, setDeferDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Promo code
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{
    code: string;
    discountCents: number;
    label: string;
  } | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  const discount = promo?.discountCents ?? 0;
  const effectiveTotal = Math.max(0, summary.totalCents - discount);
  const isFree = effectiveTotal === 0;

  // Keep the Payment Element's amount in sync with the discounted total (drives
  // which payment methods show). Skipped when free — no payment is collected.
  useEffect(() => {
    if (elements && effectiveTotal > 0) {
      elements.update({ amount: effectiveTotal });
    }
  }, [elements, effectiveTotal]);

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoBusy(true);
    setPromoError(null);
    const res = await checkPromo(code, itemsParam);
    setPromoBusy(false);
    if (!res.ok) {
      setPromo(null);
      setPromoError(res.error);
      return;
    }
    setPromo({ code: res.code, discountCents: res.discountCents, label: res.label });
  };

  const removePromo = () => {
    setPromo(null);
    setPromoInput("");
    setPromoError(null);
  };

  // Funnel events (fire once each), both sent server-side so they carry hashed
  // buyer PII and survive browser tracking-protection:
  //  - InitiateCheckout when the three required buyer fields are complete
  //  - AddPaymentInfo when the buyer first interacts with the card fields
  const icFired = useRef(false);
  const apiFired = useRef(false);

  // Recreated each render, so it always closes over the latest buyer fields.
  const trackFunnel = (event: "InitiateCheckout" | "AddPaymentInfo") => {
    fetch("/api/track/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        items: itemsParam,
        name: buyer.name,
        email: buyer.email,
        phone: buyer.phone,
      }),
      keepalive: true,
    }).catch(() => {});
  };

  useEffect(() => {
    if (icFired.current) return;
    const nameOk = buyer.name.trim().length > 0;
    const emailOk = isEmail(buyer.email);
    const phoneOk = buyer.phone.replace(/\D/g, "").length >= 8;
    if (!(nameOk && emailOk && phoneOk)) return;
    icFired.current = true;
    trackFunnel("InitiateCheckout");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyer, itemsParam]);

  const onCardChange = (e: { empty: boolean }) => {
    if (apiFired.current || e.empty) return;
    apiFired.current = true;
    trackFunnel("AddPaymentInfo");
  };

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
      phone: buyer.phone,
    });
  };

  const validate = (): string | null => {
    if (!buyer.name.trim()) return "Please enter your name.";
    if (!isEmail(buyer.email)) return "Please enter a valid email.";
    if (buyer.phone.replace(/\D/g, "").length < 8)
      return "Please enter a valid phone number.";
    // Attendee details are optional (they can be added later); just sanity-
    // check any emails that were entered.
    if (!deferDetails) {
      for (let i = 0; i < attendees.length; i++) {
        const em = attendees[i].email.trim();
        if (em && !isEmail(em)) return `Attendee ${i + 1}'s email looks invalid.`;
      }
    }
    return null;
  };

  const postCheckout = async () => {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: itemsParam,
        buyer,
        attendees: deferDetails ? [] : attendees,
        detailsDeferred: deferDetails,
        promoCode: promo?.code,
      }),
    });
    return res;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setSubmitting(true);

    // Free order (100%-off promo) — no card, no Stripe.
    if (isFree) {
      try {
        const res = await postCheckout();
        const data = await res.json();
        if (!res.ok || !data.free) {
          setError(data.error ?? "Could not complete your free order.");
          setSubmitting(false);
          return;
        }
        router.push(
          `/checkout/success?${new URLSearchParams({ order: data.orderNumber }).toString()}`,
        );
      } catch {
        setError("Network error. Please try again.");
        setSubmitting(false);
      }
      return;
    }

    if (!stripe || !elements) return;

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
      const res = await postCheckout();
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
      <OrderSummary
        summary={summary}
        discountCents={discount}
        promoLabel={promo?.label}
      />

      {/* Promo code */}
      <div className="rounded-[14px] border border-black/10 bg-white p-5">
        {promo ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[0.9rem] text-ink">
              <span className="font-bold text-pink">{promo.code}</span> applied —{" "}
              {promo.label}
            </span>
            <button
              type="button"
              onClick={removePromo}
              className="text-[0.75rem] font-bold uppercase tracking-[0.06em] text-ink/55 hover:text-ink"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              className={`${inputClass} uppercase`}
              placeholder="Promo code"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyPromo();
                }
              }}
            />
            <button
              type="button"
              onClick={applyPromo}
              disabled={promoBusy || !promoInput.trim()}
              className="shrink-0 rounded-full border-2 border-ink/20 px-5 py-2.5 text-[0.78rem] font-extrabold uppercase tracking-[0.06em] text-ink transition-colors hover:border-ink disabled:opacity-40"
            >
              {promoBusy ? "…" : "Apply"}
            </button>
          </div>
        )}
        {promoError && (
          <p className="mt-2 text-[0.85rem] font-semibold text-pink">
            {promoError}
          </p>
        )}
      </div>

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
          placeholder="Phone number"
          type="tel"
          autoComplete="tel"
          value={buyer.phone}
          onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })}
        />
      </fieldset>

      {/* Solo buyer is the attendee — just ask their role for exhibitor leads. */}
      {summary.totalQuantity === 1 && (
        <fieldset className="grid gap-3 rounded-[14px] border border-black/10 bg-white p-6">
          <legend className="px-1 text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
            About you
          </legend>
          <p className="text-[0.82rem] text-ink/55">
            Optional — helps our exhibitors know who they&apos;re chatting with
            at the expo.
          </p>
          <select
            className={inputClass}
            value={attendees[0]?.category ?? ""}
            onChange={(e) => setAttendee(0, { category: e.target.value })}
          >
            <option value="">Which best describes you?</option>
            {ATTENDEE_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </fieldset>
      )}

      {/* Attendees — only for multi-ticket orders. A solo buyer is assumed to
          be the attendee, so we don't ask for separate attendee details. */}
      {summary.totalQuantity > 1 && (
      <fieldset className="grid gap-4 rounded-[14px] border border-black/10 bg-white p-6">
        <legend className="px-1 text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
          Who&apos;s coming ({attendees.length})
        </legend>

        <label className="flex cursor-pointer items-start gap-3 rounded-[10px] bg-paper-2 p-3.5">
          <input
            type="checkbox"
            checked={deferDetails}
            onChange={(e) => setDeferDetails(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-pink"
          />
          <span className="text-[0.85rem] leading-snug text-ink/75">
            <span className="font-bold text-ink">
              I&apos;ll add my team&apos;s details later.
            </span>{" "}
            Grab the tickets now — we&apos;ll email you a link to add each
            attendee&apos;s name and email before the expo. Everyone needs their
            own email to access the event app.
          </span>
        </label>

        {!deferDetails && (
          <>
            <p className="text-[0.82rem] text-ink/55">
              Add what you know now — anything you leave blank can be filled in
              later.
            </p>
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
                    onChange={(e) =>
                      setAttendee(i, { firstName: e.target.value })
                    }
                  />
                  <input
                    className={inputClass}
                    placeholder="Last name"
                    value={a.lastName}
                    onChange={(e) =>
                      setAttendee(i, { lastName: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={inputClass}
                    placeholder="Email"
                    type="email"
                    value={a.email}
                    onChange={(e) => setAttendee(i, { email: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder="Phone"
                    type="tel"
                    value={a.phone}
                    onChange={(e) => setAttendee(i, { phone: e.target.value })}
                  />
                </div>
                <select
                  className={inputClass}
                  value={a.category}
                  onChange={(e) =>
                    setAttendee(i, { category: e.target.value })
                  }
                >
                  <option value="">{CATEGORY_PROMPT}</option>
                  {ATTENDEE_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </>
        )}
      </fieldset>
      )}

      {/* Payment — hidden when a promo makes the order free */}
      {isFree ? (
        <div className="rounded-[14px] border border-black/10 bg-paper-2 p-6 text-center">
          <p className="font-bold text-ink">This order is free 🎉</p>
          <p className="mt-1 text-[0.85rem] text-ink/65">
            No payment needed — your promo covers it in full.
          </p>
        </div>
      ) : (
        <fieldset className="grid gap-3 rounded-[14px] border border-black/10 bg-white p-6">
          <legend className="px-1 text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
            Payment
          </legend>
          <PaymentElement onChange={onCardChange} />
        </fieldset>
      )}

      {error && (
        <p className="rounded-[10px] bg-pink/10 px-4 py-3 text-[0.9rem] font-semibold text-pink">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={(!stripe && !isFree) || submitting}
        className="inline-flex items-center justify-center rounded-full bg-pink px-8 py-4 text-[0.9rem] font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:bg-pink-hot disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? "Processing…"
          : isFree
            ? "Get free tickets"
            : `Pay ${formatAud(effectiveTotal)}`}
      </button>
      {!isFree && (
        <p className="text-center text-[0.75rem] text-ink/45">
          Secure payment by Stripe. Card details are entered directly with
          Stripe and never touch our servers.
        </p>
      )}
      <p className="text-center text-[0.75rem] text-ink/45">
        By completing your purchase you agree to our{" "}
        <a
          href="/terms"
          target="_blank"
          className="font-semibold text-pink hover:underline"
        >
          Ticketing Terms &amp; Conditions
        </a>{" "}
        and{" "}
        <a
          href="/privacy"
          target="_blank"
          className="font-semibold text-pink hover:underline"
        >
          Privacy Policy
        </a>
        . Tickets are non-refundable.
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
