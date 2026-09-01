import { RawClockifyRow } from "../types";
import { MonthlyFileParseResult } from "./types";

/** Every row from every column-valid file, in file order then row order. No dedup, no
 * grouping, no recalculation — each source row passes through untouched. */
export function concatenateMonthlyRows(files: MonthlyFileParseResult[]): RawClockifyRow[] {
  const out: RawClockifyRow[] = [];
  for (const f of files) {
    if (!f.columnsValid) continue;
    out.push(...f.rows);
  }
  return out;
}

/** Stable alphabetical sort by Project (rows with the same Project keep their relative
 * concatenation order). */
export function sortRowsByProject<T extends { project: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.project.localeCompare(b.project));
}
