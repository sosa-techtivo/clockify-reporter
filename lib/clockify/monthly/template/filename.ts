import { DateOnly } from "../date";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "LendingPoint_Clockify_Time_Report_Detailed_01_MM_YYYY-DD_MM_YYYY.xlsx" using the
 * detected month's actual first/last covered dates (Phase 1's coverage validation already
 * guarantees coverageStart is the 1st and coverageEnd is the month's last day). */
export function buildMonthlyOutputFileName(coverageStart: DateOnly, coverageEnd: DateOnly): string {
  const start = `${pad2(coverageStart.day)}_${pad2(coverageStart.month)}_${coverageStart.year}`;
  const end = `${pad2(coverageEnd.day)}_${pad2(coverageEnd.month)}_${coverageEnd.year}`;
  return `LendingPoint_Clockify_Time_Report_Detailed_${start}-${end}.xlsx`;
}
