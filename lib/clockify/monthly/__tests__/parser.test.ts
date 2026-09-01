import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { MonthlyParseError, parseMonthlySourceFile } from "../parser";

function buildXlsxFile(fileName: string, aoa: (string | number)[][]): File {
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Detailed Report");
  const buffer: ArrayBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new File([buffer], fileName, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

const VALID_HEADERS = ["Project", "Client", "Description", "Task", "User", "Duration (decimal)"];

describe("parseMonthlySourceFile", () => {
  it("parses a well-formed weekly file: rows, columns, and filename date range", async () => {
    const file = buildXlsxFile("Clockify_Time_Report_Detailed_01_07_2026-07_07_2026.xlsx", [
      VALID_HEADERS,
      ["Organic Apply", "LendingPoint", "[OA-1]: test", "OA-1", "Juan David Olarte Rojas", 3.5],
    ]);

    const result = await parseMonthlySourceFile(file);

    expect(result.columnsValid).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      project: "Organic Apply",
      client: "LendingPoint",
      description: "[OA-1]: test",
      task: "OA-1",
      user: "Juan David Olarte Rojas",
      duration: 3.5,
    });
    expect(result.rangeStart).toEqual({ year: 2026, month: 7, day: 1 });
    expect(result.rangeEnd).toEqual({ year: 2026, month: 7, day: 7 });
    expect(result.dateParseError).toBeNull();
  });

  it("marks columnsValid false when a required column is missing, without throwing", async () => {
    const file = buildXlsxFile("Clockify_Time_Report_Detailed_01_07_2026-07_07_2026.xlsx", [
      ["Project", "Client", "Description", "Task", "User"],
      ["Organic Apply", "LendingPoint", "d", "OA-1", "u"],
    ]);

    const result = await parseMonthlySourceFile(file);
    expect(result.columnsValid).toBe(false);
    expect(result.rows).toEqual([]);
  });

  it("marks columnsValid false when there's an extra column beyond the expected 6", async () => {
    const file = buildXlsxFile("Clockify_Time_Report_Detailed_01_07_2026-07_07_2026.xlsx", [
      [...VALID_HEADERS, "Billable"],
      ["Organic Apply", "LendingPoint", "d", "OA-1", "u", 1, "Yes"],
    ]);

    const result = await parseMonthlySourceFile(file);
    expect(result.columnsValid).toBe(false);
  });

  it("captures a filename date-range error without throwing", async () => {
    const file = buildXlsxFile("Clockify_Time_Report_Detailed.xlsx", [VALID_HEADERS, ["Organic Apply", "LendingPoint", "d", "OA-1", "u", 1]]);
    const result = await parseMonthlySourceFile(file);
    expect(result.dateParseError).not.toBeNull();
    expect(result.rangeStart).toBeNull();
  });

  it("preserves a blank Project instead of rejecting the row (validation happens separately)", async () => {
    const file = buildXlsxFile("Clockify_Time_Report_Detailed_01_07_2026-07_07_2026.xlsx", [VALID_HEADERS, ["", "LendingPoint", "d", "", "u", 1]]);
    const result = await parseMonthlySourceFile(file);
    expect(result.columnsValid).toBe(true);
    expect(result.rows[0].project).toBe("");
  });

  it("throws for a non-Excel extension", async () => {
    const file = new File(["not excel"], "notes.txt");
    await expect(parseMonthlySourceFile(file)).rejects.toThrow(MonthlyParseError);
  });

  it("throws for an empty file", async () => {
    const file = new File([], "empty.xlsx");
    await expect(parseMonthlySourceFile(file)).rejects.toThrow(MonthlyParseError);
  });
});
