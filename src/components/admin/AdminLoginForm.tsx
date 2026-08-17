"use client";

import { useState } from "react";
import { requestAdminLink } from "@/app/admin/actions";

const inputClass =
  "w-full rounded-[10px] border border-black/15 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-pink";

export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setMessage(null);
    const res = await requestAdminLink(email);
    if (!res.ok) {
      setStatus("error");
      setMessage(res.error ?? "Something went wrong.");
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
          We&apos;ve sent an admin sign-in link to{" "}
          <span className="font-bold text-ink">{email}</span>. Tap it to open
          the admin dashboard. The link works once and expires shortly.
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
        Admin sign in
      </h2>
      <p className="mt-2 mb-4 text-[0.92rem] leading-relaxed text-ink/70">
        Enter your admin email and we&apos;ll send you a sign-in link.
      </p>
      <input
        className={inputClass}
        placeholder="you@danceteacherexpo.com.au"
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
