import { CLIENT_NAME } from "./constants";
import { classifyProject, deriveTask } from "./classifier";
import { RawClockifyRow, ProcessedRow } from "./types";

function buildGroupKey(task: string, description: string): string {
  return task.trim() !== "" ? `task:${task.trim()}` : `desc:${description}`;
}

/** Rules 2–12 — turns raw Clockify rows into processed team rows. Never drops a row
 * (Rule 1): the output array has exactly one entry per input row, in the same order. */
export function processTeamRows(rawRows: RawClockifyRow[]): ProcessedRow[] {
  return rawRows.map((raw, index) => {
    const { task, confidence: taskConfidence } = deriveTask(raw.task, raw.description);
    const { project, confidence: projectConfidence } = classifyProject({
      currentProject: raw.project,
      task,
      description: raw.description,
    });

    const row: ProcessedRow = {
      id: `team-${index}`,
      project,
      client: CLIENT_NAME,
      description: raw.description,
      task,
      user: raw.user,
      duration: raw.duration,
      projectConfidence,
      taskConfidence,
      groupKey: buildGroupKey(task, raw.description),
      isAlexRow: false,
      sourceIndex: index,
    };
    return row;
  });
}
