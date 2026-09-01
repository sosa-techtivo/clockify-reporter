import { addDays, compareDateOnly, DateOnly, firstDayOfMonth, formatIsoDate, isSameMonth, lastDayOfMonth } from "./date";
import { MonthlyFileParseResult, MonthlyValidationResult } from "./types";

interface DatedFile extends MonthlyFileParseResult {
  rangeStart: DateOnly;
  rangeEnd: DateOnly;
}

function hasUsableRange(f: MonthlyFileParseResult): f is DatedFile {
  return f.rangeStart !== null && f.rangeEnd !== null && f.dateParseError === null;
}

/** Rules for Monthly Report Phase 1: every uploaded weekly file must have exactly the
 * required columns, a resolvable date range, belong to one single target month, and
 * together cover that month with no gaps, no overlaps, and no missing edge days. Blank
 * Projects are also rejected here since they can't be NS-mapped downstream. Returns every
 * applicable error at once rather than stopping at the first one. */
export function validateMonthlyFiles(files: MonthlyFileParseResult[]): MonthlyValidationResult {
  const errors: string[] = [];

  if (files.length === 0) {
    errors.push("Upload at least one weekly report file.");
    return { errors, detectedMonth: null, coverageStart: null, coverageEnd: null };
  }

  for (const f of files) {
    if (!f.columnsValid) {
      const found = f.headers.length > 0 ? f.headers.join(", ") : "(no headers found)";
      errors.push(
        `"${f.fileName}": columns must be exactly Project, Client, Description, Task, User, Duration (decimal) — found: ${found}.`
      );
    }
  }

  for (const f of files) {
    if (f.dateParseError) errors.push(f.dateParseError);
  }

  const nameCounts = new Map<string, number>();
  for (const f of files) {
    const key = f.fileName.trim().toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  for (const [name, count] of nameCounts) {
    if (count > 1) errors.push(`Duplicate file uploaded: "${name}" appears ${count} times.`);
  }

  // Blank-Project rows are a per-row data problem, independent of date ranges — check
  // across every column-valid file regardless of how the month detection below goes.
  for (const f of files) {
    if (!f.columnsValid) continue;
    const blankCount = f.rows.filter((r) => r.project.trim() === "").length;
    if (blankCount > 0) {
      errors.push(`"${f.fileName}": ${blankCount} row(s) have a blank Project.`);
    }
  }

  const dated = files.filter(hasUsableRange);

  const wellFormedRanges: DatedFile[] = [];
  for (const f of dated) {
    if (compareDateOnly(f.rangeStart, f.rangeEnd) > 0) {
      errors.push(`"${f.fileName}": end date is before start date.`);
      continue;
    }
    if (!isSameMonth(f.rangeStart, f.rangeEnd)) {
      errors.push(`"${f.fileName}" spans more than one calendar month (${formatIsoDate(f.rangeStart)} to ${formatIsoDate(f.rangeEnd)}).`);
      continue;
    }
    wellFormedRanges.push(f);
  }

  if (wellFormedRanges.length === 0) {
    return { errors, detectedMonth: null, coverageStart: null, coverageEnd: null };
  }

  const sortedByStart = [...wellFormedRanges].sort((a, b) => compareDateOnly(a.rangeStart, b.rangeStart));
  const detectedMonth = { year: sortedByStart[0].rangeStart.year, month: sortedByStart[0].rangeStart.month };

  const sameMonthFiles: DatedFile[] = [];
  for (const f of sortedByStart) {
    if (f.rangeStart.year !== detectedMonth.year || f.rangeStart.month !== detectedMonth.month) {
      errors.push(
        `"${f.fileName}" (${formatIsoDate(f.rangeStart)} to ${formatIsoDate(f.rangeEnd)}) belongs to a different month than the rest of the batch (detected month: ${detectedMonth.year}-${String(detectedMonth.month).padStart(2, "0")}).`
      );
      continue;
    }
    sameMonthFiles.push(f);
  }

  for (let i = 1; i < sameMonthFiles.length; i++) {
    const prev = sameMonthFiles[i - 1];
    const cur = sameMonthFiles[i];
    if (compareDateOnly(cur.rangeStart, prev.rangeEnd) <= 0) {
      errors.push(
        `Overlapping date ranges: "${prev.fileName}" (${formatIsoDate(prev.rangeStart)}–${formatIsoDate(prev.rangeEnd)}) and "${cur.fileName}" (${formatIsoDate(cur.rangeStart)}–${formatIsoDate(cur.rangeEnd)}).`
      );
      continue;
    }
    const expectedNext = addDays(prev.rangeEnd, 1);
    if (compareDateOnly(cur.rangeStart, expectedNext) > 0) {
      const gapEnd = addDays(cur.rangeStart, -1);
      errors.push(`Missing coverage from ${formatIsoDate(expectedNext)} to ${formatIsoDate(gapEnd)} (gap between "${prev.fileName}" and "${cur.fileName}").`);
    }
  }

  const coverageStart = sameMonthFiles.length > 0 ? sameMonthFiles[0].rangeStart : null;
  const coverageEnd = sameMonthFiles.length > 0 ? sameMonthFiles[sameMonthFiles.length - 1].rangeEnd : null;

  if (coverageStart && coverageEnd) {
    const expectedFirst = firstDayOfMonth(detectedMonth.year, detectedMonth.month);
    const expectedLast = lastDayOfMonth(detectedMonth.year, detectedMonth.month);

    if (compareDateOnly(coverageStart, expectedFirst) > 0) {
      errors.push(`Coverage does not start on the 1st: missing ${formatIsoDate(expectedFirst)} to ${formatIsoDate(addDays(coverageStart, -1))}.`);
    }
    if (compareDateOnly(coverageEnd, expectedLast) < 0) {
      errors.push(`Coverage does not reach the end of the month: missing ${formatIsoDate(addDays(coverageEnd, 1))} to ${formatIsoDate(expectedLast)}.`);
    }
  }

  return { errors, detectedMonth, coverageStart, coverageEnd };
}
