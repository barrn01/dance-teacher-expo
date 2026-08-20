/**
 * Minimal, dependency-free CSV parser. Handles quoted fields, escaped quotes
 * (""), embedded commas/newlines, and CRLF or LF line endings. Returns rows of
 * string cells; callers trim/interpret as needed. Fully-blank lines are kept as
 * `[""]` so callers can filter them out with their own emptiness rule.
 */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/\r\n?/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++; // skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  // Flush the final field/row if the file didn't end with a newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

type Cell = string | number | null | undefined;

/** Escape one CSV cell: quote when needed, and neutralise formula injection. */
export function csvCell(v: Cell): string {
  if (v == null) return "";
  let s = String(v);
  // A cell a spreadsheet might execute as a formula (from user-supplied text)
  // is prefixed with an apostrophe so it's treated as literal text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Serialise rows to a CSV string (CRLF line endings, Excel-friendly). Prepend a
 * BOM at the download layer so Excel reads UTF-8 correctly.
 */
export function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
