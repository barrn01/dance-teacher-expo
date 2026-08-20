"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BulkResult } from "@/lib/bulk";

/** Generic CSV bulk-import panel. Reads the file client-side, hands the text to
 *  a server action, and shows a created/skipped summary + per-row errors. */
export function BulkCsvUpload({
  title,
  action,
  template,
  templateName,
  help,
}: {
  title: string;
  action: (csv: string) => Promise<BulkResult>;
  template: string;
  templateName: string;
  help: React.ReactNode;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const res = await action(text);
      if (!res.ok) setError(res.error ?? "Could not read that file.");
      else {
        setResult(res);
        if (res.created > 0) router.refresh();
      }
    } catch {
      setError("Could not read that file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = templateName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const failures = result?.results.filter((r) => !r.ok) ?? [];

  return (
    <div className="relative grid gap-4 overflow-hidden rounded-[14px] border border-black/10 bg-white p-6">
      <span className="absolute inset-x-0 top-0 h-[5px] bg-ink/70" />
      <div>
        <h2 className="text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
          {title}
        </h2>
        <p className="mt-2 text-[0.85rem] leading-relaxed text-ink/60">{help}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
          className="text-[0.85rem] text-ink/70 file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-ink file:px-5 file:py-2.5 file:text-[0.8rem] file:font-extrabold file:uppercase file:tracking-[0.06em] file:text-white hover:file:bg-char-2 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={downloadTemplate}
          className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-pink hover:underline"
        >
          Download template
        </button>
        {busy && <span className="text-[0.85rem] text-ink/50">Importing…</span>}
      </div>

      {error && (
        <p className="rounded-[10px] bg-pink/10 px-4 py-3 text-[0.9rem] font-semibold text-pink">
          {error}
        </p>
      )}

      {result && (
        <div className="grid gap-3">
          <p className="text-[0.9rem] font-semibold text-ink">
            {fileName ? `${fileName}: ` : ""}
            <span className="text-green-700">{result.created} created</span>
            {result.failed > 0 && (
              <span className="text-pink">, {result.failed} skipped</span>
            )}
            .
          </p>
          {failures.length > 0 && (
            <div className="overflow-x-auto rounded-[10px] border border-pink/25 bg-pink/[0.04]">
              <table className="w-full min-w-[420px] border-collapse text-[0.82rem]">
                <thead>
                  <tr className="border-b border-pink/20 text-left text-[0.68rem] font-bold uppercase tracking-[0.08em] text-pink/70">
                    <th className="px-3 py-2">Line</th>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {failures.map((f) => (
                    <tr
                      key={f.line}
                      className="border-b border-pink/10 last:border-0"
                    >
                      <td className="px-3 py-2 tabular-nums text-ink/60">
                        {f.line}
                      </td>
                      <td className="px-3 py-2 text-ink">{f.label || "—"}</td>
                      <td className="px-3 py-2 text-ink/70">{f.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
