import { ALEX_USER_NAME, CLIENT_NAME } from "./constants";
import { ProcessedRow } from "./types";

/** Rule 13 — one automatic 1-hour row per unique task worked by the team. Dedup key is
 * Task when present, otherwise the exact Description (Rule 16), so ambiguous items still
 * surface for Alex to review instead of being silently skipped. */
export function generateAlexRows(teamRows: ProcessedRow[]): ProcessedRow[] {
  const seen = new Map<string, ProcessedRow>();

  for (const row of teamRows) {
    if (seen.has(row.groupKey)) continue;
    seen.set(row.groupKey, row);
  }

  return [...seen.entries()].map(([groupKey, source], index) => ({
    id: `alex-${index}`,
    project: source.project,
    client: CLIENT_NAME,
    description: source.description,
    task: source.task,
    user: ALEX_USER_NAME,
    duration: 1,
    projectConfidence: source.projectConfidence,
    taskConfidence: source.taskConfidence,
    groupKey,
    isAlexRow: true,
  }));
}
