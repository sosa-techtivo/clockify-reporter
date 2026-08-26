import { generateAlexRows } from "./alex-generator";
import { buildPendingGroups } from "./pending";
import { processTeamRows } from "./processor";
import { ProcessingResult, RawClockifyRow } from "./types";

/** Runs rules 2–16 end to end: clean/classify team rows, generate Alex's rows, and
 * compute the pending-review groups. Pure function, no React / DOM dependency. */
export function runProcessingPipeline(rawRows: RawClockifyRow[]): ProcessingResult {
  const teamRows = processTeamRows(rawRows);
  const alexRows = generateAlexRows(teamRows);
  const pendingGroups = buildPendingGroups([...teamRows, ...alexRows]);

  const uniqueTaskCount = new Set(teamRows.map((r) => r.groupKey)).size;

  return {
    teamRows,
    alexRows,
    originalRowCount: rawRows.length,
    uniqueTaskCount,
    pendingGroups,
  };
}
