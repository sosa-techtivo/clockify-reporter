import { MonthlyRow } from "../types";
import { DETAILED_REPORT_HEADERS } from "./layout";
import { escapeXml, needsSpacePreserve } from "./xml-utils";

export interface SharedStringsResult {
  xml: string;
  /** value -> its <si> index, used when writing sheet1's <c t="s"><v>index</v></c> cells. */
  index: Map<string, number>;
}

/** Builds xl/sharedStrings.xml from scratch for the given rows: the 7 header labels
 * first (matching the reference template's own layout), then every distinct
 * Project/Client/Description/Task/User/NS string value in first-occurrence order.
 * Duration is numeric and never goes through the shared string table. */
export function buildSharedStrings(rows: MonthlyRow[]): SharedStringsResult {
  const index = new Map<string, number>();
  const order: string[] = [];

  function intern(value: string): void {
    if (!index.has(value)) {
      index.set(value, order.length);
      order.push(value);
    }
  }

  for (const header of DETAILED_REPORT_HEADERS) intern(header);
  for (const row of rows) {
    intern(row.project);
    intern(row.client);
    intern(row.description);
    intern(row.task);
    intern(row.user);
    intern(row.ns);
  }

  const items = order
    .map((value) => `<si><t${needsSpacePreserve(value) ? ' xml:space="preserve"' : ""}>${escapeXml(value)}</t></si>`)
    .join("");

  // 6 string cells per data row (everything but the numeric Duration column) + the 7
  // header cells, all of which are strings too.
  const totalStringCells = DETAILED_REPORT_HEADERS.length + rows.length * 6;

  const xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${totalStringCells}" uniqueCount="${order.length}">${items}</sst>`;

  return { xml, index };
}
