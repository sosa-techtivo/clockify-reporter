import { describe, expect, it } from "vitest";
import { applyNsMapping, BASE_PROJECT_NS_MAP, findUnknownProjects, getKnownNsCodes, resolveNs } from "../ns-mapping";

describe("BASE_PROJECT_NS_MAP", () => {
  it("matches the July reference mapping exactly", () => {
    expect(BASE_PROJECT_NS_MAP).toEqual({
      Automations: "NS-645",
      "Change Advisory Board": "NS-644",
      "Customer Servicing Portal Web": "NS-419",
      "Loan Servicing Platform": "NS-613",
      "Mobile APP": "NS-419",
      "Organic Apply": "NS-644",
      "Security Vulnerabilities": "NS-291",
      "Website Management": "NS-412",
      "Application Security Vulnerabilities": "NS-291",
    });
  });

  it("maps the newly added Application Security Vulnerabilities project to NS-291", () => {
    expect(resolveNs("Application Security Vulnerabilities", {})).toBe("NS-291");
  });
});

describe("resolveNs / applyNsMapping", () => {
  it("resolves a known project to its base NS", () => {
    expect(resolveNs("Automations", {})).toBe("NS-645");
  });

  it("stamps NS onto every row without touching other fields", () => {
    const rows = [
      { project: "Automations", client: "LendingPoint", description: "d", task: "t", user: "u", duration: 1 },
      { project: "Website Management", client: "LendingPoint", description: "d2", task: "t2", user: "u2", duration: 2 },
    ];
    const mapped = applyNsMapping(rows, {});
    expect(mapped[0].ns).toBe("NS-645");
    expect(mapped[1].ns).toBe("NS-412");
    expect(mapped[0].description).toBe("d");
    expect(mapped[1].duration).toBe(2);
  });

  it("leaves NS empty for an unresolved project instead of throwing", () => {
    const mapped = applyNsMapping([{ project: "Brand New Project", client: "", description: "", task: "", user: "", duration: 0 }], {});
    expect(mapped[0].ns).toBe("");
  });
});

describe("findUnknownProjects", () => {
  it("returns nothing when every project is in the base map", () => {
    const rows = [{ project: "Automations" }, { project: "Website Management" }];
    expect(findUnknownProjects(rows, {})).toEqual([]);
  });

  it("flags a project not present in the base map (needs manual review)", () => {
    const rows = [{ project: "Automations" }, { project: "New Client Portal" }];
    expect(findUnknownProjects(rows, {})).toEqual(["New Client Portal"]);
  });

  it("stops flagging a project once a session override resolves it", () => {
    const rows = [{ project: "New Client Portal" }];
    expect(findUnknownProjects(rows, { "New Client Portal": "NS-999" })).toEqual([]);
  });

  it("applies a manual override to every row of that project", () => {
    const rows = [
      { project: "New Client Portal", client: "", description: "a", task: "", user: "", duration: 1 },
      { project: "New Client Portal", client: "", description: "b", task: "", user: "", duration: 1 },
      { project: "Automations", client: "", description: "c", task: "", user: "", duration: 1 },
    ];
    const mapped = applyNsMapping(rows, { "New Client Portal": "NS-999" });
    expect(mapped[0].ns).toBe("NS-999");
    expect(mapped[1].ns).toBe("NS-999");
    expect(mapped[2].ns).toBe("NS-645");
  });
});

describe("getKnownNsCodes", () => {
  it("includes every distinct base NS code, sorted, deduplicated", () => {
    const codes = getKnownNsCodes();
    expect(codes).toEqual(["NS-291", "NS-412", "NS-419", "NS-613", "NS-644", "NS-645"]);
  });

  it("includes session overrides alongside the base codes", () => {
    const codes = getKnownNsCodes({ "New Project": "NS-999" });
    expect(codes).toContain("NS-999");
  });
});
