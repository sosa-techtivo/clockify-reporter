/** Triggers a browser download of the generated workbook bytes. DOM-only glue, not the
 * XLSX generation itself — kept separate so generate-workbook.ts stays pure/testable. */
export function downloadMonthlyWorkbook(bytes: Uint8Array, fileName: string): void {
  // Uint8Array's `buffer` type is ArrayBufferLike (could theoretically be a
  // SharedArrayBuffer), which is stricter than BlobPart requires — always a plain
  // ArrayBuffer at runtime here, so the cast is safe.
  const blob = new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
