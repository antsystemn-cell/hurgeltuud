import * as XLSX from "xlsx";
import type { NiimbotLabelData } from "./types";

/**
 * Build an Excel file compatible with Niimbot app's
 * "Import Data Source" feature. The first row contains
 * the placeholder names that map 1:1 to text fields in the
 * Niimbot label template.
 *
 * In the Niimbot app: open template → tap a text field →
 * "Insert variable" → pick the matching column header.
 */
const COLUMNS: Array<{ key: keyof NiimbotLabelData; header: string }> = [
  { key: "order_no", header: "order_no" },
  { key: "customer_name", header: "customer_name" },
  { key: "phone", header: "phone" },
  { key: "phone2", header: "phone2" },
  { key: "district", header: "district" },
  { key: "address", header: "address" },
  { key: "payment_status", header: "payment_status" },
  { key: "payment_amount", header: "payment_amount" },
  { key: "items", header: "items" },
  { key: "tracking_code", header: "tracking_code" },
  { key: "note", header: "note" },
];

export function generateNiimbotXlsx(rows: NiimbotLabelData[]): Blob {
  if (!rows.length) throw new Error("Захиалга байхгүй байна");

  const data = rows.map((r) => {
    const obj: Record<string, string> = {};
    for (const { key, header } of COLUMNS) {
      obj[header] = (r[key] ?? "").toString();
    }
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(data, {
    header: COLUMNS.map((c) => c.header),
  });

  // Sensible column widths so data is readable in the Niimbot importer
  ws["!cols"] = COLUMNS.map((c) => ({
    wch: Math.max(c.header.length + 2, 18),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Labels");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function buildXlsxFilename(count: number): string {
  const stamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace(/[-:T]/g, "");
  return `niimbot-labels-${count}-${stamp}.xlsx`;
}
