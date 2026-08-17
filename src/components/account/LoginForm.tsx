"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const inputClass =
  "w-full rounded-[10px] border border-black/15 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-pink";

export function LoginForm({
  next = "/account",
  heading = "Manage your tickets",
  intro = "Enter the email you bought with and we'll send you a sign-in link — no password needed. From there you can add or swap your attendees.",
}: {
  next?: string;
  heading?: string;
  intro?: string;
} = {}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) {
      setStatus("error");
      setMessage("Please enter a valid email.");
      return;
    }
    setStatus("sending");
    setMessage(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Land on /auth/confirm (token-hash flow) so the link works from any
        // device — see src/app/auth/confirm/route.ts.
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
  };

  if (status === "sent") {
    return (
      <div className="relative overflow-hidden rounded-[14px] border border-black/10 bg-white p-6 text-center">
        <span className="absolute inset-x-0 top-0 h-[5px] bg-pink" />
        <p className="script text-[clamp(1.4rem,4vw,2rem)] text-pink">
          Check your inbox
        </p>
        <p className="mt-2 leading-relaxed text-ink/75">
          We&apos;ve sent a sign-in link to{" "}
          <span className="font-bold text-ink">{email}</span>. Tap it to open
          your tickets. The link works once and expires shortly.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setMessage(null);
          }}
          className="mt-4 text-[0.82rem] font-bold uppercase tracking-[0.06em] text-pink hover:text-pink-hot"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="relative overflow-hidden rounded-[14px] border border-black/10 bg-white p-6"
    >
      <span className="absolute inset-x-0 top-0 h-[5px] bg-pink" />
      <h2 className="text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
        {heading}
      </h2>
      <p className="mt-2 mb-4 text-[0.92rem] leading-relaxed text-ink/70">
        {intro}
      </p>
      <input
        className={inputClass}
        placeholder="you@studio.com.au"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {message && (
        <p className="mt-3 rounded-[10px] bg-pink/10 px-4 py-3 text-[0.9rem] font-semibold text-pink">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-pink px-8 py-3.5 text-[0.9rem] font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:bg-pink-hot disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
