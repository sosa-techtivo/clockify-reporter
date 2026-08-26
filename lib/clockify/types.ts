/** A row exactly as read from the raw Clockify Excel export (only the fields we keep). */
export interface RawClockifyRow {
  project: string;
  client: string;
  description: string;
  task: string;
  user: string;
  duration: number | string;
}

export type FieldConfidence = "original" | "automatic" | "manual" | "review" | "derived" | "none";

/** A row after applying every cleaning / classification rule. Mirrors the export shape
 * plus internal-only metadata used for review, dedup and validation. Internal fields are
 * never written to the exported Excel file. */
export interface ProcessedRow {
  id: string;
  project: string;
  client: string;
  description: string;
  task: string;
  user: string;
  duration: number | string;

  projectConfidence: FieldConfidence;
  taskConfidence: FieldConfidence;

  /** Grouping identity used both for Alex's dedup and for the pending-review UI. */
  groupKey: string;

  isAlexRow: boolean;

  /** Only present on team rows: index into the original parsed sheet, used for validation. */
  sourceIndex?: number;
}

export function rowNeedsReview(row: ProcessedRow): boolean {
  return row.project.trim() === "" || row.task.trim() === "";
}

export interface PendingGroup {
  groupKey: string;
  task: string;
  description: string;
  missingProject: boolean;
  missingTask: boolean;
  affectedTeamCount: number;
  affectedAlexCount: number;
}

export interface ClassificationResult {
  project: string;
  confidence: FieldConfidence;
}

export interface TaskDerivationResult {
  task: string;
  confidence: FieldConfidence;
}

export interface ProcessingResult {
  teamRows: ProcessedRow[];
  alexRows: ProcessedRow[];
  originalRowCount: number;
  uniqueTaskCount: number;
  pendingGroups: PendingGroup[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
