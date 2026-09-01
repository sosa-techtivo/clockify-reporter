import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { MonthlyRow } from "../../types";
import { buildMonthlyWorkbookZip, MonthlyTemplateError } from "../generate-workbook";

const TEMPLATE_PATH = join(process.cwd(), "reference", "Clockify_Julio_2026.xlsx");
const templateBytes = new Uint8Array(readFileSync(TEMPLATE_PATH));
const originalEntries = unzipSync(templateBytes);
const decoder = new TextDecoder();

function hasXmllint(): boolean {
  try {
    execFileSync("xmllint", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
const xmllintAvailable = hasXmllint();

/** Synthetic August 2026 dataset that shares NO string values with the July reference
 * data, so any July leftover found in the output can only mean a regeneration bug. */
const AUGUST_ROWS: MonthlyRow[] = [
  { project: "Zzz Test Project", client: "LendingPoint", description: "ZZZ-1: synthetic desc one", task: "ZZZ-1", user: "Test User One", duration: 3.5, ns: "NS-999" },
  { project: "Zzz Test Project", client: "LendingPoint", description: "ZZZ-2: synthetic desc two", task: "ZZZ-2", user: "Test User Two", duration: 1, ns: "NS-999" },
  { project: "Aaa Other Project", client: "LendingPoint", description: "AAA-1: another synthetic desc", task: "AAA-1", user: "Test User One", duration: 7.25, ns: "NS-111" },
  { project: "Application Security Vulnerabilities", client: "LendingPoint", description: "ASV-1: pentest finding", task: "ASV-1", user: "Test User Two", duration: 2, ns: "NS-291" },
];

function generate(rows: MonthlyRow[] = AUGUST_ROWS) {
  const zipBytes = buildMonthlyWorkbookZip(templateBytes, rows);
  const entries = unzipSync(zipBytes);
  const text = (part: string) => decoder.decode(entries[part]);
  return { entries, text };
}

const JULY_ONLY_STRINGS = ["Automations", "Change Advisory Board", "[AUT-930]", "Alex Sosa", "Gregorio Vargas Miranda", "Dzorrilla"];

describe("buildMonthlyWorkbookZip — Detailed Report", () => {
  it("writes exactly one row per input row, header + N rows", () => {
    const { text } = generate();
    const sheet1 = text("xl/worksheets/sheet1.xml");
    expect(sheet1.match(/<row r="\d+">/g)?.length).toBe(AUGUST_ROWS.length + 1);
  });

  it("round-trips every row's data (Project/Description/User) through sharedStrings", () => {
    const { text } = generate();
    const sheet1 = text("xl/worksheets/sheet1.xml");
    const sharedStrings = text("xl/sharedStrings.xml");
    expect(sharedStrings).toContain("Zzz Test Project");
    expect(sharedStrings).toContain("Application Security Vulnerabilities");
    expect(sheet1).toContain('<c r="A2" s="3" t="s">');
  });

  it("keeps Duration numeric with the built-in 0.00-style format (s=4, numFmtId=4 in styles.xml)", () => {
    const { text } = generate();
    const sheet1 = text("xl/worksheets/sheet1.xml");
    // Row 2 in our dataset (Zzz Test Project) has duration 3.5.
    expect(sheet1).toContain('<c r="F2" s="4"><v>3.5</v></c>');
    expect(sheet1).not.toMatch(/<c r="F2"[^>]*t="s"/);
  });

  it("writes the NS column, including the new Application Security Vulnerabilities mapping", () => {
    const { text } = generate();
    const sheet1 = text("xl/worksheets/sheet1.xml");
    const sharedStrings = text("xl/sharedStrings.xml");
    expect(sharedStrings).toContain("NS-291");
    expect(sharedStrings).toContain("NS-999");
    expect(sharedStrings).toContain("NS-111");
    expect(sheet1).toContain('<c r="G5" s="5" t="s">'); // row 5 = 4th data row (Application Security Vulnerabilities)
  });

  it("replaces July's data completely — none of July's own strings leak into the output", () => {
    const { text } = generate();
    const sheet1 = text("xl/worksheets/sheet1.xml");
    const sharedStrings = text("xl/sharedStrings.xml");
    for (const julyString of JULY_ONLY_STRINGS) {
      expect(sheet1).not.toContain(julyString);
      expect(sharedStrings).not.toContain(julyString);
    }
  });
});

describe("buildMonthlyWorkbookZip — pivot cache & pivot table", () => {
  it("points the pivot cache source at the new Detailed Report range", () => {
    const { text } = generate();
    const cache = text("xl/pivotCache/pivotCacheDefinition1.xml");
    expect(cache).toContain(`<worksheetSource ref="A1:G${AUGUST_ROWS.length + 1}" sheet="Detailed Report"/>`);
  });

  it("regenerates cache sharedItems to the new dataset's distinct values only", () => {
    const { text } = generate();
    const cache = text("xl/pivotCache/pivotCacheDefinition1.xml");
    expect(cache).toContain("Zzz Test Project");
    expect(cache).toContain("Aaa Other Project");
    for (const julyString of JULY_ONLY_STRINGS) {
      expect(cache).not.toContain(julyString);
    }
  });

  it("keeps refreshOnLoad/invalid so Excel refreshes on open, and adds no pivotCacheRecords part", () => {
    const { text, entries } = generate();
    const cache = text("xl/pivotCache/pivotCacheDefinition1.xml");
    expect(cache).toContain('invalid="1" refreshOnLoad="1"');
    expect(entries["xl/pivotCache/pivotCacheRecords1.xml"]).toBeUndefined();
  });

  it("every pivot item index is within range of its own cache field's value count", () => {
    const { text } = generate();
    const cache = text("xl/pivotCache/pivotCacheDefinition1.xml");
    const pivotTable = text("xl/pivotTables/pivotTable1.xml");

    const fieldValueCounts = [...cache.matchAll(/<cacheField name="([^"]+)"[^>]*><sharedItems[^>]*>([\s\S]*?)<\/sharedItems>/g)].map((m) => ({
      name: m[1],
      count: (m[2].match(/<[sn] v="/g) ?? []).length,
    }));
    expect(fieldValueCounts.map((f) => f.name)).toEqual(["Project", "Client", "Description", "Task", "User", "Duration (decimal)", "NS"]);

    for (const field of fieldValueCounts) {
      const escapedName = field.name.replace(/[().]/g, (c) => `\\${c}`);
      const fieldBlock = pivotTable.match(new RegExp(`<pivotField name="${escapedName}"[^>]*>([\\s\\S]*?)</pivotField>`));
      expect(fieldBlock).not.toBeNull();
      const indexes = [...(fieldBlock as RegExpMatchArray)[1].matchAll(/<item x="(\d+)"\/>/g)].map((m) => Number(m[1]));
      expect(indexes.length).toBe(field.count);
      for (const x of indexes) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(field.count);
      }
    }
  });

  it("keeps the Project -> NS -> User -> SUM of Duration structure", () => {
    const { text } = generate();
    const pivotTable = text("xl/pivotTables/pivotTable1.xml");
    expect(pivotTable).toContain('<rowFields><field x="0"/><field x="6"/><field x="4"/></rowFields>');
    expect(pivotTable).toContain('<dataField name="SUM of Duration (decimal)" fld="5" baseField="0"/>');
  });
});

describe("buildMonthlyWorkbookZip — untouched OOXML parts (native pivot relationships/content-types preserved)", () => {
  const UNCHANGED_PARTS = [
    "[Content_Types].xml",
    "_rels/.rels",
    "xl/_rels/workbook.xml.rels",
    "xl/pivotTables/_rels/pivotTable1.xml.rels",
    "xl/pivotCache/_rels/pivotCacheDefinition1.xml.rels",
    "xl/worksheets/_rels/sheet1.xml.rels",
    "xl/worksheets/_rels/sheet2.xml.rels",
    "xl/styles.xml",
    "xl/theme/theme1.xml",
    "xl/persons/person.xml",
    "xl/drawings/drawing1.xml",
    "xl/drawings/drawing2.xml",
  ];

  it.each(UNCHANGED_PARTS)("%s is byte-identical to the template", (part) => {
    const { entries } = generate();
    expect(entries[part]).toEqual(originalEntries[part]);
  });

  it("Content_Types.xml still registers both the pivotCacheDefinition and pivotTable overrides", () => {
    const { text } = generate();
    const contentTypes = text("[Content_Types].xml");
    expect(contentTypes).toContain('PartName="/xl/pivotCache/pivotCacheDefinition1.xml"');
    expect(contentTypes).toContain('PartName="/xl/pivotTables/pivotTable1.xml"');
  });
});

describe.skipIf(!xmllintAvailable)("buildMonthlyWorkbookZip — strict XML well-formedness (xmllint)", () => {
  const REGENERATED_PARTS = [
    "xl/worksheets/sheet1.xml",
    "xl/worksheets/sheet2.xml",
    "xl/sharedStrings.xml",
    "xl/pivotCache/pivotCacheDefinition1.xml",
    "xl/pivotTables/pivotTable1.xml",
    "xl/workbook.xml",
  ];

  it.each(REGENERATED_PARTS)("%s is well-formed XML independent of our own regex-based assertions", (part) => {
    const { entries } = generate();
    const dir = mkdtempSync(join(tmpdir(), "monthly-ooxml-"));
    const filePath = join(dir, part.replace(/\//g, "_"));
    writeFileSync(filePath, entries[part]);
    expect(() => execFileSync("xmllint", ["--noout", filePath], { stdio: "pipe" })).not.toThrow();
  });
});

describe("buildMonthlyWorkbookZip — workbook shape", () => {
  it("contains exactly two worksheets: Detailed Report and Pivot Table 1", () => {
    const { text } = generate();
    const workbook = text("xl/workbook.xml");
    const sheetNames = [...workbook.matchAll(/<sheet[^>]*name="([^"]+)"/g)].map((m) => m[1]);
    expect(sheetNames).toEqual(["Detailed Report", "Pivot Table 1"]);
  });

  it("updates the _xlnm._FilterDatabase range to the new row count, dropping July's padded range", () => {
    const { text } = generate();
    const workbook = text("xl/workbook.xml");
    expect(workbook).toContain(`'Detailed Report'!$A$1:$G$${AUGUST_ROWS.length + 1}`);
    expect(workbook).not.toContain("$P$991");
  });

  it("keeps the pivotCaches reference wiring intact", () => {
    const { text } = generate();
    const workbook = text("xl/workbook.xml");
    expect(workbook).toContain('<pivotCache cacheId="0" r:id="rId7"/>');
  });
});

describe("buildMonthlyWorkbookZip — error handling", () => {
  it("refuses to generate a workbook with zero rows", () => {
    expect(() => buildMonthlyWorkbookZip(templateBytes, [])).toThrow(MonthlyTemplateError);
  });

  it("refuses an unrelated ZIP that isn't the expected template", () => {
    const bogusZip = zipSync({ "readme.txt": new TextEncoder().encode("not a workbook") });
    expect(() => buildMonthlyWorkbookZip(bogusZip, AUGUST_ROWS)).toThrow(MonthlyTemplateError);
  });
});
