import { DateOnly, parseIsoDate } from "./date";

export interface FileNameDateRange {
  start: DateOnly;
  end: DateOnly;
}

export interface FileNameDateRangeError {
  error: string;
}

/** DD_MM_YYYY-DD_MM_YYYY, e.g. "24_08_2026-31_08_2026". The (?<!\d)/(?!\d) guards keep
 * this from matching inside a longer run of digits (a trailing "_2" suffix, a version
 * number, etc.) so only a genuine 6-group date range is picked up. */
const DATE_RANGE_PATTERN = /(?<!\d)(\d{2})_(\d{2})_(\d{4})-(\d{2})_(\d{2})_(\d{4})(?!\d)/g;

/** Real Clockify Reporter weekly filename convention, e.g.
 * "Clockify_Time_Report_Detailed_24_08_2026-31_08_2026.xlsx": DD_MM_YYYY-DD_MM_YYYY,
 * first date is the range start, second is the range end (order is taken literally, never
 * auto-corrected — a reversed range is left to validateMonthlyFiles' existing
 * start-after-end check). Arbitrary text may precede the range and a harmless suffix
 * (e.g. "(1)", "_v2") may follow it before ".xlsx". */
export function parseDateRangeFromFileName(fileName: string): FileNameDateRange | FileNameDateRangeError {
  const matches = [...fileName.matchAll(DATE_RANGE_PATTERN)];

  if (matches.length !== 1) {
    return {
      error:
        matches.length === 0
          ? `Could not find a date range in "${fileName}". Expected DD_MM_YYYY-DD_MM_YYYY, e.g. "Clockify_Time_Report_Detailed_24_08_2026-31_08_2026.xlsx".`
          : `Expected exactly one date range in "${fileName}" (found ${matches.length}).`,
    };
  }

  const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = matches[0];
  const start = parseIsoDate(`${startYear}-${startMonth}-${startDay}`);
  const end = parseIsoDate(`${endYear}-${endMonth}-${endDay}`);

  if (!start || !end) {
    return { error: `"${fileName}" contains a date that isn't a valid calendar date.` };
  }

  return { start, end };
}

export function isDateRangeError(result: FileNameDateRange | FileNameDateRangeError): result is FileNameDateRangeError {
  return "error" in result;
}
