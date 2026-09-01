import { MonthlyFileParseResult, MonthlySummary, MonthlyValidationResult } from "./types";

export function buildMonthlySummary(
  files: MonthlyFileParseResult[],
  validation: MonthlyValidationResult,
  unknownProjects: string[],
  extraErrors: string[] = []
): MonthlySummary {
  return {
    detectedMonth: validation.detectedMonth,
    filesLoaded: files.length,
    coverageStart: validation.coverageStart,
    coverageEnd: validation.coverageEnd,
    totalSourceRows: files.reduce((n, f) => n + f.rows.length, 0),
    unknownProjects,
    validationErrors: [...extraErrors, ...validation.errors],
  };
}
