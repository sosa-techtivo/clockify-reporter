import { describe, expect, it } from "vitest";
import { isDateRangeError, parseDateRangeFromFileName } from "../filename-date-range";

describe("parseDateRangeFromFileName", () => {
  it("parses the real Clockify Reporter filename convention", () => {
    const result = parseDateRangeFromFileName("Clockify_Time_Report_Detailed_24_08_2026-31_08_2026.xlsx");
    expect(isDateRangeError(result)).toBe(false);
    if (!isDateRangeError(result)) {
      expect(result.start).toEqual({ year: 2026, month: 8, day: 24 });
      expect(result.end).toEqual({ year: 2026, month: 8, day: 31 });
    }
  });

  it("allows arbitrary text before the date range", () => {
    const result = parseDateRangeFromFileName("Some Random Prefix - 24_08_2026-31_08_2026.xlsx");
    expect(isDateRangeError(result)).toBe(false);
    if (!isDateRangeError(result)) {
      expect(result.start).toEqual({ year: 2026, month: 8, day: 24 });
      expect(result.end).toEqual({ year: 2026, month: 8, day: 31 });
    }
  });

  it("allows a harmless suffix between the range and the extension", () => {
    const result = parseDateRangeFromFileName("Clockify_Time_Report_Detailed_24_08_2026-31_08_2026 (1).xlsx");
    expect(isDateRangeError(result)).toBe(false);
    if (!isDateRangeError(result)) {
      expect(result.start).toEqual({ year: 2026, month: 8, day: 24 });
      expect(result.end).toEqual({ year: 2026, month: 8, day: 31 });
    }
  });

  it("takes the filename order literally: first date is start, second is end, never swapped", () => {
    // Deliberately reversed (end before start) — the filename parser itself must NOT
    // "fix" this; validateMonthlyFiles' existing start-after-end check is what catches it.
    const result = parseDateRangeFromFileName("Clockify_Time_Report_Detailed_31_08_2026-24_08_2026.xlsx");
    expect(isDateRangeError(result)).toBe(false);
    if (!isDateRangeError(result)) {
      expect(result.start).toEqual({ year: 2026, month: 8, day: 31 });
      expect(result.end).toEqual({ year: 2026, month: 8, day: 24 });
    }
  });

  it("parses a range starting on the 1st of the month", () => {
    const result = parseDateRangeFromFileName("Clockify_Time_Report_Detailed_01_08_2026-07_08_2026.xlsx");
    expect(isDateRangeError(result)).toBe(false);
    if (!isDateRangeError(result)) {
      expect(result.start).toEqual({ year: 2026, month: 8, day: 1 });
    }
  });

  it("parses a range ending on the 31st of the month", () => {
    const result = parseDateRangeFromFileName("Clockify_Time_Report_Detailed_25_08_2026-31_08_2026.xlsx");
    expect(isDateRangeError(result)).toBe(false);
    if (!isDateRangeError(result)) {
      expect(result.end).toEqual({ year: 2026, month: 8, day: 31 });
    }
  });

  it("rejects an invalid calendar date (Feb 31st doesn't exist)", () => {
    const result = parseDateRangeFromFileName("Clockify_Time_Report_Detailed_24_02_2026-31_02_2026.xlsx");
    expect(isDateRangeError(result)).toBe(true);
  });

  it("rejects a malformed filename with no date range at all", () => {
    const result = parseDateRangeFromFileName("Clockify_Time_Report_Detailed.xlsx");
    expect(isDateRangeError(result)).toBe(true);
  });

  it("rejects a filename using the old YYYY-MM-DD convention", () => {
    const result = parseDateRangeFromFileName("Clockify_Weekly_2026-08-24_2026-08-31.xlsx");
    expect(isDateRangeError(result)).toBe(true);
  });

  it("rejects a filename with only one date instead of a range", () => {
    const result = parseDateRangeFromFileName("Clockify_Time_Report_Detailed_24_08_2026.xlsx");
    expect(isDateRangeError(result)).toBe(true);
  });

  it("rejects a filename containing two separate date ranges (ambiguous)", () => {
    const result = parseDateRangeFromFileName(
      "Clockify_Time_Report_Detailed_24_08_2026-31_08_2026_and_01_09_2026-07_09_2026.xlsx"
    );
    expect(isDateRangeError(result)).toBe(true);
  });

  it("does not let a longer digit run (e.g. a trailing version number) masquerade as part of the date", () => {
    const result = parseDateRangeFromFileName("Clockify_Time_Report_Detailed_24_08_2026-31_08_20261.xlsx");
    expect(isDateRangeError(result)).toBe(true);
  });
});
