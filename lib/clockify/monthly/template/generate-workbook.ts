import { unzipSync, zipSync } from "fflate";
import { MonthlyRow } from "../types";
import { buildDetailedReportSheetXml } from "./detailed-report-sheet";
import { buildCacheFields, buildPivotCacheDefinitionXml, buildPivotTableXml, estimatePivotRowCount } from "./pivot";
import { buildPivotSheetXml } from "./pivot-sheet";
import { buildSharedStrings } from "./shared-strings";
import { patchWorkbookXml } from "./workbook-xml";

export class MonthlyTemplateError extends Error {}

const REQUIRED_TEMPLATE_PARTS = [
  "[Content_Types].xml",
  "xl/workbook.xml",
  "xl/worksheets/sheet1.xml",
  "xl/worksheets/sheet2.xml",
  "xl/pivotCache/pivotCacheDefinition1.xml",
  "xl/pivotTables/pivotTable1.xml",
];

/** Rebuilds the Monthly Report workbook by ZIP/OOXML-patching the July reference
 * template: every part NOT listed below is copied through byte-for-byte from
 * `templateBytes` — styles.xml, theme1.xml, persons.xml, both drawings, [Content_Types].xml,
 * and every .rels file (including workbook.xml.rels, pivotTable1.xml.rels,
 * pivotCacheDefinition1.xml.rels) are untouched, which is what keeps the native
 * PivotTable's relationships, styles, and Content-Types registrations intact.
 *
 * Only six parts are regenerated, all from the SAME `cacheFields` (computed once here)
 * so the cache's sharedItems and the pivot's item indexes can never disagree with each
 * other or with the Detailed Report sheet they describe:
 *  - xl/worksheets/sheet1.xml       (Detailed Report data)
 *  - xl/sharedStrings.xml           (string table for sheet1)
 *  - xl/pivotCache/pivotCacheDefinition1.xml (source range + sharedItems)
 *  - xl/pivotTables/pivotTable1.xml (pivot field item indexes + location)
 *  - xl/worksheets/sheet2.xml       (empty placeholder rows, resized)
 *  - xl/workbook.xml                (only the _xlnm._FilterDatabase range)
 *
 * `rows` must already be the fully consolidated, Project-sorted, NS-mapped Phase 1
 * dataset — this function does no dedup/grouping/recalculation of its own. */
export function buildMonthlyWorkbookZip(templateBytes: Uint8Array, rows: MonthlyRow[]): Uint8Array {
  if (rows.length === 0) {
    throw new MonthlyTemplateError("Cannot generate a Monthly Report with zero rows.");
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(templateBytes);
  } catch {
    throw new MonthlyTemplateError("The Monthly Report template could not be read as a .xlsx/ZIP file.");
  }

  for (const part of REQUIRED_TEMPLATE_PARTS) {
    if (!entries[part]) {
      throw new MonthlyTemplateError(`Template is missing expected part "${part}" — is this reference/Clockify_Julio_2026.xlsx?`);
    }
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  // Single source of truth for every cache index used below — never recomputed.
  const cacheFields = buildCacheFields(rows);
  const sharedStrings = buildSharedStrings(rows);
  const detailedReportXml = buildDetailedReportSheetXml(rows, sharedStrings.index);
  const pivotCacheXml = buildPivotCacheDefinitionXml(cacheFields, rows.length);
  const pivotTableXml = buildPivotTableXml(cacheFields, rows);
  const pivotSheetXml = buildPivotSheetXml(estimatePivotRowCount(rows));
  const workbookXml = patchWorkbookXml(decoder.decode(entries["xl/workbook.xml"]), rows.length + 1);

  const output: Record<string, Uint8Array> = { ...entries };
  output["xl/worksheets/sheet1.xml"] = encoder.encode(detailedReportXml);
  output["xl/sharedStrings.xml"] = encoder.encode(sharedStrings.xml);
  output["xl/pivotCache/pivotCacheDefinition1.xml"] = encoder.encode(pivotCacheXml);
  output["xl/pivotTables/pivotTable1.xml"] = encoder.encode(pivotTableXml);
  output["xl/worksheets/sheet2.xml"] = encoder.encode(pivotSheetXml);
  output["xl/workbook.xml"] = encoder.encode(workbookXml);

  return zipSync(output, { level: 6 });
}
