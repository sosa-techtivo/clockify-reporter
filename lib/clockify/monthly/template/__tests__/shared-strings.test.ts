import { describe, expect, it } from "vitest";
import { MonthlyRow } from "../../types";
import { buildSharedStrings } from "../shared-strings";

function row(overrides: Partial<MonthlyRow> = {}): MonthlyRow {
  return { project: "Automations", client: "LendingPoint", description: "d", task: "t", user: "u", duration: 1, ns: "NS-645", ...overrides };
}

describe("buildSharedStrings", () => {
  it("puts the 7 header labels first, in order", () => {
    const { index } = buildSharedStrings([row()]);
    expect(index.get("Project")).toBe(0);
    expect(index.get("Client")).toBe(1);
    expect(index.get("Description")).toBe(2);
    expect(index.get("Task")).toBe(3);
    expect(index.get("User")).toBe(4);
    expect(index.get("Duration (decimal)")).toBe(5);
    expect(index.get("NS")).toBe(6);
  });

  it("interns each distinct string value exactly once", () => {
    const rows = [row({ description: "same" }), row({ description: "same" }), row({ description: "different" })];
    const { index, xml } = buildSharedStrings(rows);
    expect(index.get("same")).toBeDefined();
    expect(index.get("different")).toBeDefined();
    expect(xml.match(/<si>/g)?.length).toBe(index.size);
  });

  it("never interns Duration — it's numeric, not a shared string", () => {
    const { index } = buildSharedStrings([row({ duration: 3.5 })]);
    expect(index.has("3.5")).toBe(false);
  });

  it("computes count as 7 headers + 6 string cells per row", () => {
    const rows = [row(), row({ project: "Other" }), row({ project: "Third" })];
    const { xml } = buildSharedStrings(rows);
    const countMatch = xml.match(/count="(\d+)"/);
    expect(countMatch?.[1]).toBe(String(7 + rows.length * 6));
  });

  it("sets uniqueCount to the number of <si> entries", () => {
    const { xml, index } = buildSharedStrings([row()]);
    const uniqueMatch = xml.match(/uniqueCount="(\d+)"/);
    expect(uniqueMatch?.[1]).toBe(String(index.size));
  });

  it("escapes XML special characters", () => {
    const { xml } = buildSharedStrings([row({ description: `A & B <C> "D"` })]);
    expect(xml).toContain("A &amp; B &lt;C&gt; &quot;D&quot;");
    expect(xml).not.toContain(`A & B <C>`);
  });

  it("preserves significant leading/trailing whitespace with xml:space", () => {
    const { xml } = buildSharedStrings([row({ description: "trailing space " })]);
    expect(xml).toContain('<t xml:space="preserve">trailing space </t>');
  });

  it("does not add xml:space when there is no leading/trailing whitespace", () => {
    const { xml } = buildSharedStrings([row({ description: "no padding" })]);
    expect(xml).toContain("<t>no padding</t>");
  });
});
