import { describe, expect, it } from "vitest";
import { generateAlexRows } from "../alex-generator";
import { processTeamRows } from "../processor";
import { ALEX_USER_NAME, PROJECT_NAMES } from "../constants";
import { RawClockifyRow } from "../types";

function row(overrides: Partial<RawClockifyRow>): RawClockifyRow {
  return {
    project: "",
    client: "",
    description: "",
    task: "",
    user: "Team Member",
    duration: 1,
    ...overrides,
  };
}

describe("generateAlexRows", () => {
  it("collapses the same Task worked by 3 different users into a single 1-hour Alex row", () => {
    const raw: RawClockifyRow[] = [
      row({ user: "Juan", description: "[OA-1234]: Fix inactive partner" }),
      row({ user: "Gregorio", description: "[OA-1234]: Fix inactive partner" }),
      row({ user: "Daniel", description: "[OA-1234]: Fix inactive partner" }),
    ];
    const teamRows = processTeamRows(raw);
    const alexRows = generateAlexRows(teamRows);

    expect(alexRows).toHaveLength(1);
    expect(alexRows[0]).toMatchObject({
      task: "OA-1234",
      project: PROJECT_NAMES.ORGANIC_APPLY,
      user: ALEX_USER_NAME,
      duration: 1,
      client: "LendingPoint",
    });
  });

  it("generates one row per unique Task, and does not drop tasks with no key (dedup by Description)", () => {
    const raw: RawClockifyRow[] = [
      row({ user: "Juan", description: "[OA-1234]: Fix inactive partner" }),
      row({ user: "Gregorio", description: "[WEB-9]: Update banner" }),
      row({ user: "Daniel", description: "Ad-hoc call with vendor" }),
      row({ user: "Marta", description: "Ad-hoc call with vendor" }),
    ];
    const teamRows = processTeamRows(raw);
    const alexRows = generateAlexRows(teamRows);

    expect(alexRows).toHaveLength(3);
    const noKeyRow = alexRows.find((r) => r.description === "Ad-hoc call with vendor");
    expect(noKeyRow).toBeDefined();
    expect(noKeyRow?.task).toBe("");
    expect(noKeyRow?.project).toBe("");
    expect(noKeyRow?.duration).toBe(1);
  });

  it("respects an already-informed Project/Task and never modifies team rows", () => {
    const raw: RawClockifyRow[] = [row({ project: "Loan Servicing Platform", task: "SO-1", description: "Custom" })];
    const teamRows = processTeamRows(raw);
    expect(teamRows[0].project).toBe("Loan Servicing Platform");
    expect(teamRows[0].task).toBe("SO-1");
    expect(teamRows).toHaveLength(1);
  });
});
