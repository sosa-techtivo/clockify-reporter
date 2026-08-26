import * as XLSX from "xlsx";
import { SOURCE_COLUMN_ALIASES } from "./constants";
import { RawClockifyRow } from "./types";
import { repairZipDataDescriptors } from "./zip-repair";

export class ClockifyParseError extends Error {}

const REQUIRED_HEADERS = ["Project", "Client", "Description", "Task", "User", "Duration (decimal)"];

export interface ParsedClockifyFile {
  rows: RawClockifyRow[];
  sourceFileName: string;
}

/** Reads a Clockify "Detailed Report" .xlsx file into normalized raw rows.
 * Runs entirely client-side (SheetJS in-memory parsing, no upload). */
export async function parseClockifyFile(file: File): Promise<ParsedClockifyFile> {
  if (file.size === 0) {
    throw new ClockifyParseError("The file is empty.");
  }

  const validExtension = /\.(xlsx|xls)$/i.test(file.name);
  if (!validExtension) {
    throw new ClockifyParseError("Please upload a valid Excel file (.xlsx or .xls).");
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new ClockifyParseError("Could not read the file. It may be corrupted.");
  }

  // Some Clockify exports write a ZIP data descriptor with a correct compressed size and
  // CRC32 but a zeroed-out uncompressed size (the real value is only in the central
  // directory). SheetJS still decompresses the content correctly but logs a "Bad
  // uncompressed size" console.error for every entry. Repair those bytes against the
  // authoritative central directory before parsing so the diagnostic never fires.
  buffer = repairZipDataDescriptors(buffer);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array" });
  } catch {
    throw new ClockifyParseError("This file could not be parsed as Excel. It may be corrupted or in an unsupported format.");
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new ClockifyParseError("The Excel file has no sheets.");
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new ClockifyParseError(`Sheet "${sheetName}" could not be read.`);
  }

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (json.length === 0) {
    throw new ClockifyParseError("The report has no data rows.");
  }

  const headers = Object.keys(json[0]);
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    throw new ClockifyParseError(
      `This doesn't look like a Clockify detailed report. Missing expected column(s): ${missing.join(", ")}.`
    );
  }

  const rows: RawClockifyRow[] = json.map((record, i) => {
    const row: Partial<RawClockifyRow> = {};
    for (const [header, field] of Object.entries(SOURCE_COLUMN_ALIASES)) {
      const value = record[header];
      if (field === "duration") {
        row.duration = normalizeDuration(value, i);
      } else {
        row[field] = value === undefined || value === null ? "" : String(value);
      }
    }
    return row as RawClockifyRow;
  });

  return { rows, sourceFileName: file.name };
}

function normalizeDuration(value: unknown, rowIndex: number): number | string {
  if (value === "" || value === undefined || value === null) {
    throw new ClockifyParseError(`Row ${rowIndex + 2}: "Duration (decimal)" is missing.`);
  }
  if (typeof value === "number") return value;
  const parsed = Number(String(value).trim());
  if (Number.isNaN(parsed)) {
    throw new ClockifyParseError(`Row ${rowIndex + 2}: "Duration (decimal)" value "${value}" is not a valid number.`);
  }
  return parsed;
}
