import { describe, expect, it } from "vitest";
import { generateAlexRows } from "../alex-generator";
import { applyPendingCorrection, buildPendingGroups } from "../pending";
import { processTeamRows } from "../processor";
import { PROJECT_NAMES } from "../constants";
import { RawClockifyRow } from "../types";

describe("review pending", () => {
  it("applying a correction updates every team row and the Alex row sharing the same Task", () => {
    const raw: RawClockifyRow[] = [
      {
        project: "",
        client: "",
        description: "[OVER-620]: VOS | UI | Loading Screen Sequence & Timeout Handling for Oscilar Processing",
        task: "",
        user: "Juan",
        duration: 2,
      },
      {
        project: "",
        client: "",
        description: "[OVER-620]: VOS | UI | Loading Screen Sequence & Timeout Handling for Oscilar Processing",
        task: "",
        user: "Gregorio",
        duration: 1,
      },
    ];

    const teamRows = processTeamRows(raw);
    const alexRows = generateAlexRows(teamRows);
    const allRows = [...teamRows, ...alexRows];

    const pendingGroups = buildPendingGroups(allRows);
    expect(pendingGroups).toHaveLength(1);
    expect(pendingGroups[0].affectedTeamCount).toBe(2);
    expect(pendingGroups[0].affectedAlexCount).toBe(1);

    const corrected = applyPendingCorrection(allRows, pendingGroups[0].groupKey, {
      project: PROJECT_NAMES.ORGANIC_APPLY,
    });

    expect(corrected.every((r) => r.project === PROJECT_NAMES.ORGANIC_APPLY)).toBe(true);
    expect(corrected.filter((r) => r.groupKey === pendingGroups[0].groupKey)).toHaveLength(3);
    expect(buildPendingGroups(corrected)).toHaveLength(0);
  });

  it("never overwrites a Project that Clockify already provided when only Task is missing", () => {
    const raw: RawClockifyRow[] = [
      {
        project: "Loan Servicing Platform",
        client: "",
        description: "Ad-hoc production incident call",
        task: "",
        user: "Juan",
        duration: 1,
      },
    ];

    const teamRows = processTeamRows(raw);
    const pendingGroups = buildPendingGroups(teamRows);
    expect(pendingGroups).toHaveLength(1);
    expect(pendingGroups[0].missingProject).toBe(false);
    expect(pendingGroups[0].missingTask).toBe(true);

    const corrected = applyPendingCorrection(teamRows, pendingGroups[0].groupKey, { task: "INC-1" });
    expect(corrected[0].project).toBe("Loan Servicing Platform");
    expect(corrected[0].task).toBe("INC-1");
  });
});
