import { describe, expect, it } from "vitest";
import { patchWorkbookXml, WorkbookXmlPatchError } from "../workbook-xml";

const TEMPLATE_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="...">` +
  `<sheets><sheet name="Detailed Report" sheetId="1" r:id="rId5"/><sheet name="Pivot Table 1" sheetId="2" r:id="rId6"/></sheets>` +
  `<definedNames><definedName hidden="1" localSheetId="0" name="_xlnm._FilterDatabase">'Detailed Report'!$A$1:$P$991</definedName></definedNames>` +
  `<pivotCaches><pivotCache cacheId="0" r:id="rId7"/></pivotCaches></workbook>`;

describe("patchWorkbookXml", () => {
  it("replaces only the _xlnm._FilterDatabase range", () => {
    const result = patchWorkbookXml(TEMPLATE_XML, 42);
    expect(result).toContain("'Detailed Report'!$A$1:$G$42</definedName>");
    expect(result).not.toContain("$P$991");
  });

  it("leaves the sheet list and pivotCaches reference untouched", () => {
    const result = patchWorkbookXml(TEMPLATE_XML, 42);
    expect(result).toContain('<sheet name="Detailed Report" sheetId="1" r:id="rId5"/>');
    expect(result).toContain('<sheet name="Pivot Table 1" sheetId="2" r:id="rId6"/>');
    expect(result).toContain('<pivotCache cacheId="0" r:id="rId7"/>');
  });

  it("throws instead of silently no-op'ing when the expected range isn't found", () => {
    expect(() => patchWorkbookXml("<workbook/>", 42)).toThrow(WorkbookXmlPatchError);
  });
});
