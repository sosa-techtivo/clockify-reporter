import { describe, expect, it } from "vitest";
import { buildMonthlyOutputFileName } from "../filename";

describe("buildMonthlyOutputFileName", () => {
  it("builds the expected filename for a full August 2026 coverage", () => {
    const name = buildMonthlyOutputFileName({ year: 2026, month: 8, day: 1 }, { year: 2026, month: 8, day: 31 });
    expect(name).toBe("LendingPoint_Clockify_Time_Report_Detailed_01_08_2026-31_08_2026.xlsx");
  });

  it("zero-pads single-digit day/month", () => {
    const name = buildMonthlyOutputFileName({ year: 2026, month: 2, day: 1 }, { year: 2026, month: 2, day: 28 });
    expect(name).toBe("LendingPoint_Clockify_Time_Report_Detailed_01_02_2026-28_02_2026.xlsx");
  });
});
