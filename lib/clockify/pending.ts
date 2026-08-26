import { PendingGroup, ProcessedRow, rowNeedsReview } from "./types";

/** Rules 15–16 — groups every row that needs review (empty Project and/or Task) by
 * Task when available, otherwise by exact Description, across team + Alex rows. */
export function buildPendingGroups(allRows: ProcessedRow[]): PendingGroup[] {
  const groups = new Map<string, PendingGroup>();

  for (const row of allRows) {
    if (!rowNeedsReview(row)) continue;

    let group = groups.get(row.groupKey);
    if (!group) {
      group = {
        groupKey: row.groupKey,
        task: row.task,
        description: row.description,
        missingProject: false,
        missingTask: false,
        affectedTeamCount: 0,
        affectedAlexCount: 0,
      };
      groups.set(row.groupKey, group);
    }

    if (row.project.trim() === "") group.missingProject = true;
    if (row.task.trim() === "") group.missingTask = true;
    if (row.isAlexRow) group.affectedAlexCount += 1;
    else group.affectedTeamCount += 1;
  }

  return [...groups.values()].sort((a, b) => {
    const keyA = a.task || a.description;
    const keyB = b.task || b.description;
    return keyA.localeCompare(keyB);
  });
}

/** Rule 15 — applying a correction updates every row sharing the same groupKey at once,
 * so the user never has to fix the same task twice. Only the fields that were actually
 * missing are passed in: a row whose Project was already respected from the original
 * report (only Task was blank) must never have that Project overwritten by this dialog.
 * Returns a new array (immutable update). */
export function applyPendingCorrection(
  allRows: ProcessedRow[],
  groupKey: string,
  correction: { project?: string; task?: string }
): ProcessedRow[] {
  return allRows.map((row) => {
    if (row.groupKey !== groupKey) return row;

    const nextProject = row.project.trim() === "" && correction.project ? correction.project : row.project;
    const nextTask = row.task.trim() === "" && correction.task ? correction.task.trim() : row.task;

    return {
      ...row,
      project: nextProject,
      projectConfidence: nextProject !== row.project ? "manual" : row.projectConfidence,
      task: nextTask,
      taskConfidence: nextTask !== row.task ? "manual" : row.taskConfidence,
    };
  });
}
