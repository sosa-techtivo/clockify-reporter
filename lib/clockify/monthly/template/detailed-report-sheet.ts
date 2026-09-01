import { MonthlyRow } from "../types";
import { COLUMN_LETTERS, DETAILED_REPORT_HEADERS } from "./layout";

/** Style indices copied verbatim from the July template's xl/styles.xml — reused, never
 * redefined, so styles.xml itself never has to change. s=4 carries numFmtId="4"
 * (built-in "#,##0.00"), which is where Duration's numeric formatting comes from. */
const HEADER_STYLE_MAIN = 1;
const HEADER_STYLE_NS = 2;
const DATA_STYLE_MAIN = 3;
const DATA_STYLE_DURATION = 4;
const DATA_STYLE_NS = 5;

function stringCell(ref: string, style: number, sharedIndex: number): string {
  return `<c r="${ref}" s="${style}" t="s"><v>${sharedIndex}</v></c>`;
}

function numberCell(ref: string, style: number, value: number): string {
  return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
}

function requireIndex(index: Map<string, number>, value: string): number {
  const found = index.get(value);
  if (found === undefined) {
    throw new Error(`Internal error: "${value}" is missing from the shared string table.`);
  }
  return found;
}

/** Builds xl/worksheets/sheet1.xml (Detailed Report) from scratch: same frozen header
 * pane, column widths, and per-column cell styles as the July template, sized to
 * whatever row count this month actually has. Rows are written in the order given —
 * callers are expected to have already sorted them by Project (Phase 1's job). */
export function buildDetailedReportSheetXml(rows: MonthlyRow[], sharedIndex: Map<string, number>): string {
  const headerCells = DETAILED_REPORT_HEADERS.map((header, i) => {
    const col = COLUMN_LETTERS[i];
    const style = col === "G" ? HEADER_STYLE_NS : HEADER_STYLE_MAIN;
    return stringCell(`${col}1`, style, requireIndex(sharedIndex, header));
  }).join("");

  const dataRows = rows
    .map((row, i) => {
      const r = i + 2;
      const cells =
        stringCell(`A${r}`, DATA_STYLE_MAIN, requireIndex(sharedIndex, row.project)) +
        stringCell(`B${r}`, DATA_STYLE_MAIN, requireIndex(sharedIndex, row.client)) +
        stringCell(`C${r}`, DATA_STYLE_MAIN, requireIndex(sharedIndex, row.description)) +
        stringCell(`D${r}`, DATA_STYLE_MAIN, requireIndex(sharedIndex, row.task)) +
        stringCell(`E${r}`, DATA_STYLE_MAIN, requireIndex(sharedIndex, row.user)) +
        numberCell(`F${r}`, DATA_STYLE_DURATION, Number(row.duration)) +
        stringCell(`G${r}`, DATA_STYLE_NS, requireIndex(sharedIndex, row.ns));
      return `<row r="${r}">${cells}</row>`;
    })
    .join("");

  const lastRow = rows.length + 1;

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mx="http://schemas.microsoft.com/office/mac/excel/2008/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:mv="urn:schemas-microsoft-com:mac:vml" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:x15="http://schemas.microsoft.com/office/spreadsheetml/2010/11/main" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">` +
    `<sheetPr><pageSetUpPr/></sheetPr>` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1.0" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection activeCell="B3" sqref="B3" pane="bottomLeft"/></sheetView></sheetViews>` +
    `<sheetFormatPr customHeight="1" defaultColWidth="14.43" defaultRowHeight="15.0"/>` +
    `<cols><col customWidth="1" min="1" max="1" width="33.14"/><col customWidth="1" min="2" max="2" width="13.43"/><col customWidth="1" min="3" max="3" width="137.29"/><col customWidth="1" min="4" max="4" width="23.29"/><col customWidth="1" min="5" max="5" width="24.86"/><col customWidth="1" min="6" max="6" width="21.57"/><col customWidth="1" min="7" max="16" width="8.71"/></cols>` +
    `<sheetData><row r="1">${headerCells}</row>${dataRows}</sheetData>` +
    `<autoFilter ref="$A$1:$G$${lastRow}"/>` +
    `<printOptions/><pageMargins bottom="0.75" footer="0.0" header="0.0" left="0.7" right="0.7" top="0.75"/><pageSetup orientation="landscape"/><drawing r:id="rId1"/>` +
    `</worksheet>`
  );
}
