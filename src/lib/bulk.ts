// Shared shapes for CSV bulk-import actions + the generic upload component.

export type BulkRowResult = {
  line: number; // 1-based line in the uploaded file
  label: string; // what the row was (e.g. the name/title)
  ok: boolean;
  error?: string;
};

export type BulkResult = {
  ok: boolean;
  error?: string;
  created: number;
  failed: number;
  results: BulkRowResult[];
};
