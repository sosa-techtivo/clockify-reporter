import { describe, expect, it } from "vitest";
import { RawClockifyRow } from "../../types";
import { DateOnly } from "../date";
import { MonthlyFileParseResult } from "../types";
import { validateMonthlyFiles } from "../validate";

function d(year: number, month: number, day: number): DateOnly {
  return { year, month, day };
}

function row(overrides: Partial<RawClockifyRow> = {}): RawClockifyRow {
  return {
    project: "Organic Apply",
    client: "LendingPoint",
    description: "[OA-1]: test",
    task: "OA-1",
    user: "Juan David Olarte Rojas",
    duration: 2,
    ...overrides,
  };
}

function file(overrides: Partial<MonthlyFileParseResult> = {}): MonthlyFileParseResult {
  return {
    fileName: "Clockify_Weekly_2026-07-01_2026-07-05.xlsx",
    headers: ["Project", "Client", "Description", "Task", "User", "Duration (decimal)"],
    columnsValid: true,
    rows: [row()],
    rangeStart: d(2026, 7, 1),
    rangeEnd: d(2026, 7, 5),
    dateParseError: null,
    ...overrides,
  };
}

/** A clean 5-file July 2026 (31 days) split with no gaps/overlaps, used as the "valid"
 * baseline that individual tests mutate. */
function validJulyFiles(): MonthlyFileParseResult[] {
  return [
    file({ fileName: "Clockify_Weekly_2026-07-01_2026-07-05.xlsx", rangeStart: d(2026, 7, 1), rangeEnd: d(2026, 7, 5) }),
    file({ fileName: "Clockify_Weekly_2026-07-06_2026-07-12.xlsx", rangeStart: d(2026, 7, 6), rangeEnd: d(2026, 7, 12) }),
    file({ fileName: "Clockify_Weekly_2026-07-13_2026-07-19.xlsx", rangeStart: d(2026, 7, 13), rangeEnd: d(2026, 7, 19) }),
    file({ fileName: "Clockify_Weekly_2026-07-20_2026-07-26.xlsx", rangeStart: d(2026, 7, 20), rangeEnd: d(2026, 7, 26) }),
    file({ fileName: "Clockify_Weekly_2026-07-27_2026-07-31.xlsx", rangeStart: d(2026, 7, 27), rangeEnd: d(2026, 7, 31) }),
  ];
}

describe("validateMonthlyFiles", () => {
  it("accepts a full, contiguous, gap-free July coverage", () => {
    const result = validateMonthlyFiles(validJulyFiles());
    expect(result.errors).toEqual([]);
    expect(result.detectedMonth).toEqual({ year: 2026, month: 7 });
    expect(result.coverageStart).toEqual(d(2026, 7, 1));
    expect(result.coverageEnd).toEqual(d(2026, 7, 31));
  });

  it("flags a duplicate file (same filename uploaded twice)", () => {
    const files = validJulyFiles();
    files.push(file({ ...files[0] }));
    const result = validateMonthlyFiles(files);
    expect(result.errors.some((e) => e.toLowerCase().includes("duplicate file"))).toBe(true);
  });

  it("flags overlapping date ranges", () => {
    const files = [
      file({ fileName: "week-a.xlsx", rangeStart: d(2026, 7, 1), rangeEnd: d(2026, 7, 10) }),
      file({ fileName: "week-b.xlsx", rangeStart: d(2026, 7, 8), rangeEnd: d(2026, 7, 15) }),
    ];
    const result = validateMonthlyFiles(files);
    expect(result.errors.some((e) => e.toLowerCase().includes("overlap"))).toBe(true);
  });

  it("flags a gap between files", () => {
    const files = [
      file({ fileName: "week-a.xlsx", rangeStart: d(2026, 7, 1), rangeEnd: d(2026, 7, 5) }),
      file({ fileName: "week-b.xlsx", rangeStart: d(2026, 7, 10), rangeEnd: d(2026, 7, 15) }),
    ];
    const result = validateMonthlyFiles(files);
    expect(result.errors.some((e) => e.toLowerCase().includes("missing coverage"))).toBe(true);
  });

  it("flags coverage that doesn't start on the 1st", () => {
    const files = validJulyFiles();
    files[0] = file({ fileName: "Clockify_Weekly_2026-07-02_2026-07-05.xlsx", rangeStart: d(2026, 7, 2), rangeEnd: d(2026, 7, 5) });
    const result = validateMonthlyFiles(files);
    expect(result.errors.some((e) => e.toLowerCase().includes("does not start on the 1st"))).toBe(true);
  });

  it("flags coverage that doesn't reach the end of the month", () => {
    const files = validJulyFiles();
    files[4] = file({ fileName: "Clockify_Weekly_2026-07-27_2026-07-30.xlsx", rangeStart: d(2026, 7, 27), rangeEnd: d(2026, 7, 30) });
    const result = validateMonthlyFiles(files);
    expect(result.errors.some((e) => e.toLowerCase().includes("does not reach the end of the month"))).toBe(true);
  });

  it("flags files that belong to different months", () => {
    const files = [
      file({ fileName: "july.xlsx", rangeStart: d(2026, 7, 1), rangeEnd: d(2026, 7, 31) }),
      file({ fileName: "august.xlsx", rangeStart: d(2026, 8, 1), rangeEnd: d(2026, 8, 7) }),
    ];
    const result = validateMonthlyFiles(files);
    expect(result.errors.some((e) => e.toLowerCase().includes("different month"))).toBe(true);
  });

  it("flags a file whose columns don't exactly match the expected 6", () => {
    const files = [
      file({ headers: ["Project", "Client", "Description", "Task", "User"], columnsValid: false, rows: [] }),
    ];
    const result = validateMonthlyFiles(files);
    expect(result.errors.some((e) => e.includes("columns must be exactly"))).toBe(true);
  });

  it("flags a file with an extra, unexpected column as invalid", () => {
    const files = [
      file({
        headers: ["Project", "Client", "Description", "Task", "User", "Duration (decimal)", "Billable"],
        columnsValid: false,
        rows: [],
      }),
    ];
    const result = validateMonthlyFiles(files);
    expect(result.errors.some((e) => e.includes("columns must be exactly"))).toBe(true);
  });

  it("flags any row with a blank Project", () => {
    const files = validJulyFiles();
    files[0] = file({
      fileName: files[0].fileName,
      rangeStart: files[0].rangeStart,
      rangeEnd: files[0].rangeEnd,
      rows: [row({ project: "" }), row()],
    });
    const result = validateMonthlyFiles(files);
    expect(result.errors.some((e) => e.includes("blank Project"))).toBe(true);
  });

  it("requires at least one file", () => {
    const result = validateMonthlyFiles([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
