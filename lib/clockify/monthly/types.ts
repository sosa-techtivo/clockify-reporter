import { RawClockifyRow } from "../types";
import { DateOnly } from "./date";

/** Result of parsing one uploaded weekly file, before any cross-file validation.
 * Never throws for a business-rule problem (bad columns, bad filename date range) — those
 * are surfaced as flags/messages here so validateMonthlyFiles() can report every problem
 * across every file at once instead of failing on the first bad file. */
export interface MonthlyFileParseResult {
  fileName: string;
  /** Raw header row exactly as found in the sheet, for error messages / debugging. */
  headers: string[];
  /** True only when headers are exactly Project, Client, Description, Task, User,
   * Duration (decimal) — no more, no fewer. */
  columnsValid: boolean;
  /** Untouched — same values as in the uploaded file. Empty when columnsValid is false. */
  rows: RawClockifyRow[];
  rangeStart: DateOnly | null;
  rangeEnd: DateOnly | null;
  /** Set when the filename's date range couldn't be determined; rangeStart/End are null. */
  dateParseError: string | null;
}

export interface MonthlyValidationResult {
  errors: string[];
  detectedMonth: { year: number; month: number } | null;
  coverageStart: DateOnly | null;
  coverageEnd: DateOnly | null;
}

export interface MonthlyRow extends RawClockifyRow {
  ns: string;
}

export interface MonthlySummary {
  detectedMonth: { year: number; month: number } | null;
  filesLoaded: number;
  coverageStart: DateOnly | null;
  coverageEnd: DateOnly | null;
  totalSourceRows: number;
  unknownProjects: string[];
  validationErrors: string[];
}
