"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  uploadVendorDocument,
  deleteVendorDocument,
} from "@/app/vendor/actions";
import { DOC_TYPES, DOC_TYPE_LABEL } from "@/lib/vendor-logos";
import type { VendorDocumentWithUrl } from "@/lib/vendors";

const inputClass =
  "w-full rounded-[9px] border border-black/15 bg-white px-3 py-2 text-[0.9rem] text-ink outline-none transition-colors focus:border-pink";
const labelClass =
  "text-[0.62rem] font-bold uppercase tracking-[0.09em] text-ink/45";

const statusStyle: Record<string, string> = {
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-pink/15 text-pink",
};

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VendorDocuments({ docs }: { docs: VendorDocumentWithUrl[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [docType, setDocType] = useState<string>(DOC_TYPES[0].key);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;
    setBusy(true);
    setError(null);
    const res = await uploadVendorDocument(new FormData(formRef.current));
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Upload failed.");
      return;
    }
    formRef.current.reset();
    setDocType(DOC_TYPES[0].key);
    router.refresh();
  };

  const remove = async (id: string) => {
    setBusy(true);
    await deleteVendorDocument(id);
    setBusy(false);
    setPendingDelete(null);
    router.refresh();
  };

  return (
    <section className="relative grid gap-4 overflow-hidden rounded-[14px] border border-black/10 bg-white p-6">
      <span className="absolute inset-x-0 top-0 h-[5px] bg-pink" />
      <div>
        <h2 className="text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
          Documents
        </h2>
        <p className="mt-1 text-[0.85rem] leading-relaxed text-ink/55">
          Upload your public liability insurance, signed contract and any safety
          documents. These are private — only you and the DTE team can see them.
        </p>
      </div>

      {docs.length > 0 && (
        <ul className="grid gap-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-black/10 px-4 py-3"
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
              <div className="flex items-center gap-2">
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
                {pendingDelete === d.id ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(d.id)}
                      className="rounded-full bg-pink px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.04em] text-white hover:bg-pink-hot disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(null)}
                      className="text-[0.68rem] font-bold uppercase tracking-[0.04em] text-ink/45 hover:text-ink"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(d.id)}
                    className="rounded-full px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.04em] text-pink hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Upload */}
      <form
        ref={formRef}
        onSubmit={submit}
        className="grid gap-3 rounded-[12px] border border-dashed border-black/15 bg-paper/50 p-4"
      >
        <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.1em] text-ink/50">
          Upload a document
        </span>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <label className={labelClass}>Type</label>
            <select
              name="doc_type"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className={inputClass}
            >
              {DOC_TYPES.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <label className={labelClass}>Label (optional)</label>
            <input
              name="label"
              placeholder="e.g. Certificate of Currency 2027"
              className={inputClass}
            />
          </div>
        </div>
        <input
          type="file"
          name="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="text-[0.82rem] file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-[0.72rem] file:font-extrabold file:uppercase file:tracking-[0.06em] file:text-white hover:file:bg-char-2"
        />
        <p className="text-[0.72rem] text-ink/45">
          PDF, PNG, JPG or WEBP · up to 10 MB.
        </p>
        {error && (
          <p className="rounded-[9px] bg-pink/10 px-3 py-2 text-[0.85rem] font-semibold text-pink">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="justify-self-start rounded-full bg-pink px-6 py-2.5 text-[0.8rem] font-extrabold uppercase tracking-[0.07em] text-white transition-colors hover:bg-pink-hot disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Upload document"}
        </button>
      </form>
    </section>
  );
}
