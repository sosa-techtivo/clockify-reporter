import * as XLSX from "xlsx";
import { EXPORT_COLUMNS } from "./constants";
import { ProcessedRow } from "./types";

/** Rule 17 — final row order: by Project, with blanks (pending review) sorted last. */
export function sortForExport(rows: ProcessedRow[]): ProcessedRow[] {
  return [...rows].sort((a, b) => {
    const aEmpty = a.project.trim() === "";
    const bEmpty = b.project.trim() === "";
    if (aEmpty && !bEmpty) return 1;
    if (!aEmpty && bEmpty) return -1;
    return a.project.localeCompare(b.project);
  });
}

/** Rule 18 — builds the downloadable workbook with only the 6 required columns, in order,
 * plus light formatting (autofilter, sane column widths). Bold headers and frozen panes
 * are not applied: the free SheetJS "xlsx" writer does not support cell styling or pane
 * freezing when writing .xlsx (both require the paid SheetJS Pro build). */
export function buildExportWorkbook(rows: ProcessedRow[]): XLSX.WorkBook {
  const sorted = sortForExport(rows);

  const aoa: (string | number)[][] = [
    [...EXPORT_COLUMNS],
    ...sorted.map((row) => [row.project, row.client, row.description, row.task, row.user, row.duration]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  worksheet["!cols"] = [
    { wch: 28 }, // Project
    { wch: 16 }, // Client
    { wch: 70 }, // Description
    { wch: 14 }, // Task
    { wch: 20 }, // User
    { wch: 16 }, // Duration (decimal)
  ];

  const lastRow = aoa.length;
  worksheet["!autofilter"] = { ref: `A1:F${lastRow}` };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  return workbook;
}

/** Rule 18 — derives "<original>_PROCESSED.xlsx" from the uploaded file name. */
export function buildExportFileName(sourceFileName: string): string {
  const withoutExtension = sourceFileName.replace(/\.(xlsx|xls)$/i, "");
  return `${withoutExtension}_PROCESSED.xlsx`;
}

export function downloadWorkbook(workbook: XLSX.WorkBook, fileName: string): void {
  XLSX.writeFile(workbook, fileName);
}
