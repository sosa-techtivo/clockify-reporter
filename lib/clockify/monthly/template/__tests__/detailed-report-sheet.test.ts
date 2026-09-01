import { describe, expect, it } from "vitest";
import { MonthlyRow } from "../../types";
import { buildDetailedReportSheetXml } from "../detailed-report-sheet";
import { buildSharedStrings } from "../shared-strings";

function row(overrides: Partial<MonthlyRow> = {}): MonthlyRow {
  return { project: "Automations", client: "LendingPoint", description: "d", task: "t", user: "u", duration: 1, ns: "NS-645", ...overrides };
}

function sheetFor(rows: MonthlyRow[]): string {
  const { index } = buildSharedStrings(rows);
  return buildDetailedReportSheetXml(rows, index);
}

describe("buildDetailedReportSheetXml", () => {
  it("writes one <row> per data row, plus the header row", () => {
    const rows = [row(), row({ project: "P2" }), row({ project: "P3" })];
    const xml = sheetFor(rows);
    expect(xml.match(/<row r="\d+">/g)?.length).toBe(rows.length + 1);
  });

  it("uses header styles s=1 for A-F and s=2 for G", () => {
    const xml = sheetFor([row()]);
    expect(xml).toContain('<c r="A1" s="1" t="s">');
    expect(xml).toContain('<c r="F1" s="1" t="s">');
    expect(xml).toContain('<c r="G1" s="2" t="s">');
  });

  it("uses data styles s=3 for A-E, s=4 for Duration (F), s=5 for NS (G)", () => {
    const xml = sheetFor([row()]);
    expect(xml).toContain('<c r="A2" s="3" t="s">');
    expect(xml).toContain('<c r="E2" s="3" t="s">');
    expect(xml).toContain('<c r="F2" s="4">');
    expect(xml).toContain('<c r="G2" s="5" t="s">');
  });

  it("writes Duration as a plain numeric cell (no t attribute, no string lookup)", () => {
    const xml = sheetFor([row({ duration: 3.5 })]);
    expect(xml).toContain('<c r="F2" s="4"><v>3.5</v></c>');
  });

  it("sizes the autoFilter to the actual row count", () => {
    const rows = [row(), row({ project: "P2" }), row({ project: "P3" })];
    const xml = sheetFor(rows);
    expect(xml).toContain(`<autoFilter ref="$A$1:$G$${rows.length + 1}"/>`);
  });

  it("references the frozen header pane and the drawing relationship", () => {
    const xml = sheetFor([row()]);
    expect(xml).toContain('<pane ySplit="1.0" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(xml).toContain('<drawing r:id="rId1"/>');
  });

  it("throws instead of silently emitting a broken cell if a value is missing from the shared string index", () => {
    expect(() => buildDetailedReportSheetXml([row()], new Map())).toThrow();
  });
});
