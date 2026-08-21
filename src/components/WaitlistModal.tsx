"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const FORM_ID = "S3cu0eYUhRWflrmlzzNU";
const FORM_SRC = `https://links.danceprincipalsunited.com/widget/form/${FORM_ID}`;
const EMBED_JS = "https://links.danceprincipalsunited.com/js/form_embed.js";

type Variant = "primary" | "outline";

const buttonClass: Record<Variant, string> = {
  primary:
    "inline-flex items-center rounded-full bg-pink px-8 py-4 text-[0.85rem] font-extrabold uppercase tracking-[0.08em] text-white shadow-[0_12px_28px_rgba(226,52,128,0.35)] transition-transform hover:-translate-y-0.5",
  outline:
    "inline-flex items-center rounded-full border-2 border-white/35 px-8 py-4 text-[0.85rem] font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:border-white",
};

/**
 * "Add me to the waitlist" button that opens the existing GoHighLevel
 * "DTE Ticket Waitlist Form" in a branded modal. The GHL iframe + its embed
 * script are only mounted while the modal is open, so the third-party script
 * never loads for visitors who don't click. All data is captured inside GHL's
 * own form — the platform never handles it.
 */
export function WaitlistButton({
  variant = "primary",
  label = "Add me to the waitlist",
}: {
  variant?: Variant;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  // Close on Escape and lock body scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass[variant]}
      >
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Join the ticket waitlist"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-[min(460px,94vw)] flex-col overflow-hidden rounded-2xl bg-ink shadow-[0_24px_70px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
          >
            {/* Branded header — tells the visitor what they're signing up for */}
            <div className="relative shrink-0 border-b border-white/10 px-6 pb-5 pt-6 text-center">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/dte27-logo.svg"
                alt="Dance Teacher Expo 2027"
                className="mx-auto h-8 w-auto"
              />
              <h2 className="mt-4 text-[1.15rem] font-extrabold text-white">
                Join the ticket waitlist
              </h2>
              <p className="mx-auto mt-1.5 max-w-[34ch] text-[0.85rem] leading-relaxed text-white/65">
                Be first to know when Dance Teacher Expo 2027 tickets open —
                pop your details in below.
              </p>
            </div>

            {/* GHL form (scrolls within the modal on small screens) */}
            <div className="flex-1 overflow-y-auto">
              <iframe
                src={FORM_SRC}
                title="DTE Ticket Waitlist Form"
                id={`inline-${FORM_ID}`}
                data-layout="{'id':'INLINE'}"
                data-form-id={FORM_ID}
                data-form-name="DTE Ticket Waitlist Form"
                className="w-full border-none"
                style={{ height: 620, width: "100%" }}
              />
              <Script src={EMBED_JS} strategy="afterInteractive" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
