import * as XLSX from "xlsx";
import { SOURCE_COLUMN_ALIASES } from "../constants";
import { normalizeDuration } from "../parser";
import { RawClockifyRow } from "../types";
import { repairZipDataDescriptors } from "../zip-repair";
import { isDateRangeError, parseDateRangeFromFileName } from "./filename-date-range";
import { MonthlyFileParseResult } from "./types";

export class MonthlyParseError extends Error {}

/** Exactly the 6 columns a finalized weekly report must have, in the order this app
 * itself writes them (see EXPORT_COLUMNS) — reused as the single source of truth for
 * both what a weekly file exports and what a monthly file must ingest. */
const EXPECTED_COLUMNS = Object.keys(SOURCE_COLUMN_ALIASES);

/** Reads one finalized weekly .xlsx as source-of-truth data: no classification, no Alex
 * row generation, no value changes. Column-shape and blank-Project problems are reported
 * on the returned result (not thrown) so the caller can validate every uploaded file
 * together; this only throws for files that can't be read as Excel at all. */
export async function parseMonthlySourceFile(file: File): Promise<MonthlyFileParseResult> {
  if (file.size === 0) {
    throw new MonthlyParseError(`"${file.name}" is empty.`);
  }

  const validExtension = /\.(xlsx|xls)$/i.test(file.name);
  if (!validExtension) {
    throw new MonthlyParseError(`"${file.name}" is not a valid Excel file (.xlsx or .xls).`);
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new MonthlyParseError(`Could not read "${file.name}". It may be corrupted.`);
  }

  buffer = repairZipDataDescriptors(buffer);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array" });
  } catch {
    throw new MonthlyParseError(`"${file.name}" could not be parsed as Excel. It may be corrupted or in an unsupported format.`);
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new MonthlyParseError(`"${file.name}" has no sheets.`);
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new MonthlyParseError(`Sheet "${sheetName}" in "${file.name}" could not be read.`);
  }

  const headerRow = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })[0] ?? [];
  const headers = headerRow.map((h) => String(h ?? "").trim()).filter((h) => h !== "");

  const columnsValid =
    headers.length === EXPECTED_COLUMNS.length &&
    EXPECTED_COLUMNS.every((h) => headers.includes(h)) &&
    headers.every((h) => EXPECTED_COLUMNS.includes(h));

  const dateRangeResult = parseDateRangeFromFileName(file.name);
  const rangeStart = isDateRangeError(dateRangeResult) ? null : dateRangeResult.start;
  const rangeEnd = isDateRangeError(dateRangeResult) ? null : dateRangeResult.end;
  const dateParseError = isDateRangeError(dateRangeResult) ? dateRangeResult.error : null;

  if (!columnsValid) {
    return { fileName: file.name, headers, columnsValid, rows: [], rangeStart, rangeEnd, dateParseError };
  }

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const rows: RawClockifyRow[] = json.map((record, i) => {
    const row: Partial<RawClockifyRow> = {};
    for (const [header, field] of Object.entries(SOURCE_COLUMN_ALIASES)) {
      const value = record[header];
      if (field === "duration") {
        try {
          row.duration = normalizeDuration(value, i);
        } catch (e) {
          throw new MonthlyParseError(`"${file.name}": ${e instanceof Error ? e.message : "invalid Duration value"}`);
        }
      } else {
        row[field] = value === undefined || value === null ? "" : String(value);
      }
    }
    return row as RawClockifyRow;
  });

  return { fileName: file.name, headers, columnsValid, rows, rangeStart, rangeEnd, dateParseError };
}
