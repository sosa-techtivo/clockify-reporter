import { describe, expect, it } from "vitest";
import { buildPivotSheetXml } from "../pivot-sheet";

describe("buildPivotSheetXml", () => {
  it("writes exactly rowCount empty placeholder rows", () => {
    const xml = buildPivotSheetXml(10);
    expect(xml.match(/<row r="\d+"\/>/g)?.length).toBe(10);
  });

  it("writes no <c> cells — Excel populates the grid on refresh, not this file", () => {
    const xml = buildPivotSheetXml(10);
    expect(xml).not.toContain("<c ");
  });

  it("keeps the drawing relationship reference", () => {
    const xml = buildPivotSheetXml(5);
    expect(xml).toContain('<drawing r:id="rId2"/>');
  });
});
