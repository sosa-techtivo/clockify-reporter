import { describe, expect, it } from "vitest";
import { RawClockifyRow } from "../../types";
import { concatenateMonthlyRows, sortRowsByProject } from "../consolidate";
import { MonthlyFileParseResult } from "../types";

function row(overrides: Partial<RawClockifyRow> = {}): RawClockifyRow {
  return { project: "Organic Apply", client: "LendingPoint", description: "d", task: "t", user: "u", duration: 1, ...overrides };
}

function file(rows: RawClockifyRow[], columnsValid = true): MonthlyFileParseResult {
  return {
    fileName: "f.xlsx",
    headers: [],
    columnsValid,
    rows,
    rangeStart: null,
    rangeEnd: null,
    dateParseError: null,
  };
}

describe("concatenateMonthlyRows", () => {
  it("concatenates every row from every file without deduping identical rows", () => {
    const sameRow = row({ description: "duplicate on purpose" });
    const files = [file([sameRow, sameRow]), file([row({ description: "other" })])];
    const result = concatenateMonthlyRows(files);
    expect(result).toHaveLength(3);
    expect(result.filter((r) => r.description === "duplicate on purpose")).toHaveLength(2);
  });

  it("preserves every row exactly as parsed (no recalculation)", () => {
    const files = [file([row({ duration: 3.75 })])];
    expect(concatenateMonthlyRows(files)[0].duration).toBe(3.75);
  });

  it("skips rows from a file whose columns were invalid", () => {
    const files = [file([row()], false), file([row({ description: "valid file" })], true)];
    const result = concatenateMonthlyRows(files);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("valid file");
  });
});

describe("sortRowsByProject", () => {
  it("sorts rows alphabetically by Project", () => {
    const rows = [row({ project: "Website Management" }), row({ project: "Automations" }), row({ project: "Mobile APP" })];
    const sorted = sortRowsByProject(rows);
    expect(sorted.map((r) => r.project)).toEqual(["Automations", "Mobile APP", "Website Management"]);
  });

  it("keeps rows with the same Project in their original relative order (stable sort)", () => {
    const rows = [
      row({ project: "Automations", description: "first" }),
      row({ project: "Automations", description: "second" }),
    ];
    const sorted = sortRowsByProject(rows);
    expect(sorted.map((r) => r.description)).toEqual(["first", "second"]);
  });

  it("does not mutate the input array", () => {
    const rows = [row({ project: "B" }), row({ project: "A" })];
    const original = [...rows];
    sortRowsByProject(rows);
    expect(rows).toEqual(original);
  });
});
