/** Builds xl/worksheets/sheet2.xml ("Pivot Table 1"). Like the reference template, the
 * cells are intentionally left empty — the pivot's real rendered grid is populated by
 * Excel's own refresh (pivotCacheDefinition1.xml carries refreshOnLoad="1"), not baked
 * into this file. `rowCount` only sizes the empty <row/> placeholders. */
export function buildPivotSheetXml(rowCount: number): string {
  const rows = Array.from({ length: Math.max(rowCount, 1) }, (_, i) => `<row r="${i + 1}"/>`).join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mx="http://schemas.microsoft.com/office/mac/excel/2008/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:mv="urn:schemas-microsoft-com:mac:vml" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:x15="http://schemas.microsoft.com/office/spreadsheetml/2010/11/main" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">` +
    `<sheetPr><outlinePr summaryBelow="0" summaryRight="0"/></sheetPr>` +
    `<sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews>` +
    `<sheetFormatPr customHeight="1" defaultColWidth="14.43" defaultRowHeight="15.0"/>` +
    `<cols><col customWidth="1" min="1" max="1" width="32.0"/><col customWidth="1" min="2" max="2" width="11.86"/><col customWidth="1" min="3" max="3" width="22.29"/><col customWidth="1" min="4" max="4" width="23.71"/></cols>` +
    `<sheetData>${rows}</sheetData>` +
    `<drawing r:id="rId2"/>` +
    `</worksheet>`
  );
}
