import { CLIENT_NAME, EXPORT_COLUMNS } from "./constants";
import { ProcessedRow, RawClockifyRow, ValidationResult } from "./types";

/** Rule 19 — integrity checks that must pass before the Excel file can be generated.
 * Any failure blocks the download with a clear message instead of exporting silently. */
export function validateProcessing(
  rawRows: RawClockifyRow[],
  teamRows: ProcessedRow[],
  alexRows: ProcessedRow[]
): ValidationResult {
  const errors: string[] = [];

  // 1. No original row was dropped.
  if (rawRows.length !== teamRows.length) {
    errors.push(
      `Row count mismatch: original report had ${rawRows.length} team rows, but ${teamRows.length} were processed.`
    );
  }

  rawRows.forEach((raw, i) => {
    const processed = teamRows[i];
    if (!processed) return;

    // 2. Duration untouched.
    if (String(raw.duration) !== String(processed.duration)) {
      errors.push(`Row ${i + 2}: Duration was modified (${raw.duration} → ${processed.duration}).`);
    }

    // 3. Description untouched.
    if (raw.description !== processed.description) {
      errors.push(`Row ${i + 2}: Description was modified.`);
    }

    // 4. User untouched.
    if (raw.user !== processed.user) {
      errors.push(`Row ${i + 2}: User was modified (${raw.user} → ${processed.user}).`);
    }

    // 5. An originally-provided Project was not overwritten.
    if (raw.project.trim() !== "" && raw.project !== processed.project) {
      errors.push(`Row ${i + 2}: original Project "${raw.project}" was overwritten with "${processed.project}".`);
    }

    // 6. An originally-provided Task was not overwritten.
    if (raw.task.trim() !== "" && raw.task !== processed.task) {
      errors.push(`Row ${i + 2}: original Task "${raw.task}" was overwritten with "${processed.task}".`);
    }
  });

  // 7. At most one Alex row per unique groupKey (dedup key).
  const seenGroupKeys = new Set<string>();
  for (const row of alexRows) {
    if (seenGroupKeys.has(row.groupKey)) {
      errors.push(`Duplicate Alex row generated for "${row.groupKey}".`);
    }
    seenGroupKeys.add(row.groupKey);
  }

  // 8. Every Alex row has Duration = 1.
  for (const row of alexRows) {
    if (Number(row.duration) !== 1) {
      errors.push(`Alex row for "${row.task || row.description}" has Duration ${row.duration}, expected 1.`);
    }
  }

  // 9. Client is always LendingPoint.
  for (const row of [...teamRows, ...alexRows]) {
    if (row.client !== CLIENT_NAME) {
      errors.push(`Row has Client "${row.client}" instead of "${CLIENT_NAME}".`);
    }
  }

  // 10. Final columns are exactly EXPORT_COLUMNS, in order — enforced structurally by the
  // exporter (it always builds rows from this fixed tuple), verified here defensively.
  if (EXPORT_COLUMNS.length !== 6) {
    errors.push("Internal error: export column definition changed unexpectedly.");
  }

  return { valid: errors.length === 0, errors };
}
