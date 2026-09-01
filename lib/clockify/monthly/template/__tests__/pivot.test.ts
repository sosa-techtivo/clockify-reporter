import { describe, expect, it } from "vitest";
import { MonthlyRow } from "../../types";
import { buildCacheFields, buildPivotCacheDefinitionXml, buildPivotTableXml, estimatePivotRowCount, CacheField } from "../pivot";

function row(overrides: Partial<MonthlyRow> = {}): MonthlyRow {
  return { project: "Automations", client: "LendingPoint", description: "d", task: "t", user: "u", duration: 1, ns: "NS-645", ...overrides };
}

const SAMPLE_ROWS: MonthlyRow[] = [
  row({ project: "Website Management", ns: "NS-412", user: "Bob", duration: 1 }),
  row({ project: "Automations", ns: "NS-645", user: "Alex", duration: 2 }),
  row({ project: "Automations", ns: "NS-645", user: "Zoe", duration: 3 }),
  row({ project: "Automations", ns: "NS-644", user: "Alex", duration: 1.5 }),
];

/** Extracts each named <pivotField>'s <item x="N"/> indexes, in document order, from a
 * generated pivotTable1.xml string. */
function extractItemIndexes(pivotTableXml: string, fieldName: string): number[] {
  const fieldRegex = new RegExp(`<pivotField name="${fieldName}"[^>]*>([\\s\\S]*?)</pivotField>`);
  const match = pivotTableXml.match(fieldRegex);
  if (!match) throw new Error(`pivotField "${fieldName}" not found`);
  return [...match[1].matchAll(/<item x="(\d+)"\/>/g)].map((m) => Number(m[1]));
}

describe("buildCacheFields", () => {
  it("produces one field per column in the fixed Detailed Report order", () => {
    const fields = buildCacheFields(SAMPLE_ROWS);
    expect(fields.map((f) => f.name)).toEqual(["Project", "Client", "Description", "Task", "User", "Duration (decimal)", "NS"]);
  });

  it("deduplicates values in first-occurrence order", () => {
    const fields = buildCacheFields(SAMPLE_ROWS);
    const project = fields[0];
    expect(project.values).toEqual(["Website Management", "Automations"]);
  });

  it("marks Duration as numeric with numFmtId 4", () => {
    const fields = buildCacheFields(SAMPLE_ROWS);
    const duration = fields[5];
    expect(duration.kind).toBe("number");
    expect(duration.numFmtId).toBe(4);
    expect(duration.values).toEqual([1, 2, 3, 1.5]);
  });
});

describe("buildPivotCacheDefinitionXml", () => {
  it("points worksheetSource at A1:G{rowCount+1}", () => {
    const fields = buildCacheFields(SAMPLE_ROWS);
    const xml = buildPivotCacheDefinitionXml(fields, SAMPLE_ROWS.length);
    expect(xml).toContain(`<worksheetSource ref="A1:G${SAMPLE_ROWS.length + 1}" sheet="Detailed Report"/>`);
  });

  it("preserves refreshOnLoad and invalid so Excel recomputes on open", () => {
    const fields = buildCacheFields(SAMPLE_ROWS);
    const xml = buildPivotCacheDefinitionXml(fields, SAMPLE_ROWS.length);
    expect(xml).toContain('invalid="1" refreshOnLoad="1"');
  });

  it("never emits a pivotCacheRecords reference (the reference template has none)", () => {
    const fields = buildCacheFields(SAMPLE_ROWS);
    const xml = buildPivotCacheDefinitionXml(fields, SAMPLE_ROWS.length);
    expect(xml).not.toContain("pivotCacheRecords");
    expect(xml).not.toContain("r:id");
  });

  it("marks the Duration cacheField as numeric-only", () => {
    const fields = buildCacheFields(SAMPLE_ROWS);
    const xml = buildPivotCacheDefinitionXml(fields, SAMPLE_ROWS.length);
    expect(xml).toContain('containsSemiMixedTypes="0" containsString="0" containsNumber="1"');
  });
});

describe("buildPivotTableXml", () => {
  it("keeps the Project -> NS -> User row hierarchy and SUM of Duration data field", () => {
    const fields = buildCacheFields(SAMPLE_ROWS);
    const xml = buildPivotTableXml(fields, SAMPLE_ROWS);
    expect(xml).toContain("<rowFields><field x=\"0\"/><field x=\"6\"/><field x=\"4\"/></rowFields>");
    expect(xml).toContain('<dataField name="SUM of Duration (decimal)" fld="5" baseField="0"/>');
  });

  it("orders axis field items (Project, User, NS) alphabetically by value via cache index", () => {
    const fields = buildCacheFields(SAMPLE_ROWS);
    const xml = buildPivotTableXml(fields, SAMPLE_ROWS);

    // Project cache order: [Website Management(0), Automations(1)] -> alpha: Automations, Website Management
    expect(extractItemIndexes(xml, "Project")).toEqual([1, 0]);
  });

  it("orders non-axis field items (Client, Description, Task, Duration) in plain cache order", () => {
    const fields = buildCacheFields(SAMPLE_ROWS);
    const xml = buildPivotTableXml(fields, SAMPLE_ROWS);
    const durationCount = fields[5].values.length;
    expect(extractItemIndexes(xml, "Duration \\(decimal\\)")).toEqual([...Array(durationCount).keys()]);
  });

  it("every pivotField's item indexes are valid indexes into that field's own cache values (no drift)", () => {
    const fields: CacheField[] = buildCacheFields(SAMPLE_ROWS);
    const xml = buildPivotTableXml(fields, SAMPLE_ROWS);
    const escapedNames = fields.map((f) => f.name.replace(/[().]/g, (c) => `\\${c}`));
    fields.forEach((field, i) => {
      const indexes = extractItemIndexes(xml, escapedNames[i]);
      expect(indexes.length).toBe(field.values.length);
      for (const x of indexes) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(field.values.length);
      }
    });
  });

  it("carries numFmtId=4 on the Duration pivotField (pivot-level display format)", () => {
    const fields = buildCacheFields(SAMPLE_ROWS);
    const xml = buildPivotTableXml(fields, SAMPLE_ROWS);
    expect(xml).toMatch(/<pivotField name="Duration \(decimal\)" dataField="1" compact="0" numFmtId="4"/);
  });

  it("emits no rowItems/colItems/pivotTableStyleInfo, matching the reference's reliance on refresh-on-load", () => {
    const fields = buildCacheFields(SAMPLE_ROWS);
    const xml = buildPivotTableXml(fields, SAMPLE_ROWS);
    expect(xml).not.toContain("rowItems");
    expect(xml).not.toContain("colItems");
    expect(xml).not.toContain("pivotTableStyleInfo");
  });
});

describe("estimatePivotRowCount", () => {
  it("counts 3 header rows + leaves + Project-NS groups + Projects + 1 grand total", () => {
    // Leaves: (Automations,NS-645,Alex) (Automations,NS-645,Zoe) (Automations,NS-644,Alex) (Website,NS-412,Bob) = 4
    // Project-NS groups: (Automations,NS-645) (Automations,NS-644) (Website,NS-412) = 3
    // Projects: Automations, Website Management = 2
    expect(estimatePivotRowCount(SAMPLE_ROWS)).toBe(3 + 4 + 3 + 2 + 1);
  });
});
