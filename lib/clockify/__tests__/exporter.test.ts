import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildExportWorkbook, sortForExport } from "../exporter";
import { ProcessedRow } from "../types";

function row(overrides: Partial<ProcessedRow>): ProcessedRow {
  return {
    id: "1",
    project: "Organic Apply",
    client: "LendingPoint",
    description: "[OA-1]: test",
    task: "OA-1",
    user: "Team Member",
    duration: 1,
    projectConfidence: "automatic",
    taskConfidence: "derived",
    groupKey: "task:OA-1",
    isAlexRow: false,
    ...overrides,
  };
}

describe("buildExportWorkbook — Duration (decimal) number format", () => {
  it('applies the "0.00" Excel number format to every Duration cell without changing the underlying value', () => {
    const rows: ProcessedRow[] = [
      row({ id: "1", duration: 3, user: "Juan" }),
      row({ id: "2", duration: 1.5, user: "Gregorio" }),
      row({ id: "3", duration: 0.25, user: "Daniel" }),
      row({ id: "alex", duration: 1, user: "Alex Sosa", isAlexRow: true }),
    ];

    const workbook = buildExportWorkbook(rows);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const sorted = sortForExport(rows);

    // Sanity: header row itself must be untouched (no number format on a text cell).
    expect(sheet["F1"].v).toBe("Duration (decimal)");
    expect(sheet["F1"].z).toBeUndefined();

    sorted.forEach((sourceRow, i) => {
      const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: 5 });
      const cell = sheet[cellRef];

      expect(cell.z).toBe("0.00"); // 1. cell carries the "0.00" number format
      expect(cell.t).toBe("n"); // 2. still a real numeric cell, not a string
      expect(cell.v).toBe(sourceRow.duration); // 3./4. underlying value is unchanged (3 stays 3, 1.5 stays 1.5)
    });

    // 5. Explicitly confirm the format reaches Alex's automatically generated row too.
    const alexIndex = sorted.findIndex((r) => r.isAlexRow);
    expect(alexIndex).toBeGreaterThanOrEqual(0);
    const alexCellRef = XLSX.utils.encode_cell({ r: alexIndex + 1, c: 5 });
    expect(sheet[alexCellRef].z).toBe("0.00");
    expect(sheet[alexCellRef].v).toBe(1);
  });

  it("leaves other columns without any number format", () => {
    const rows: ProcessedRow[] = [row({ duration: 2 })];
    const workbook = buildExportWorkbook(rows);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Project (A), Client (B), Description (C), Task (D), User (E) on the one data row.
    for (const col of ["A2", "B2", "C2", "D2", "E2"]) {
      expect(sheet[col].z).toBeUndefined();
    }
  });
});
