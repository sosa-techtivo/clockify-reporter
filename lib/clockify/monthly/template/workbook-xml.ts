export class WorkbookXmlPatchError extends Error {}

const TEMPLATE_FILTER_DATABASE_RANGE = "'Detailed Report'!$A$1:$P$991";

/** The only thing in xl/workbook.xml that depends on this month's row count: the hidden
 * _xlnm._FilterDatabase defined name, which the July template left oversized ($P$991 —
 * far beyond its own 7-column/291-row data). Everything else in workbook.xml (sheet
 * list, rIds, the pivotCaches reference) is data-independent and stays byte-identical.
 * Uses a literal substring replace (not a regex) so no character in the target or
 * replacement needs escaping; throws instead of silently no-op'ing if the template ever
 * stops matching what this function expects. */
export function patchWorkbookXml(templateWorkbookXml: string, detailedReportLastRow: number): string {
  if (!templateWorkbookXml.includes(TEMPLATE_FILTER_DATABASE_RANGE)) {
    throw new WorkbookXmlPatchError(
      `xl/workbook.xml did not contain the expected _xlnm._FilterDatabase range (${TEMPLATE_FILTER_DATABASE_RANGE}). The template may have changed — refusing to guess.`
    );
  }
  const replacement = `'Detailed Report'!$A$1:$G$${detailedReportLastRow}`;
  return templateWorkbookXml.replace(TEMPLATE_FILTER_DATABASE_RANGE, replacement);
}
