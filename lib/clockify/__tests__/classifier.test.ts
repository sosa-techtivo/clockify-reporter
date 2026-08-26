import { describe, expect, it } from "vitest";
import { classifyProject, deriveTask } from "../classifier";
import { PROJECT_NAMES } from "../constants";

/** Mirrors what processor.ts does: derive Task from Description, then classify Project,
 * exactly like a Clockify row that arrived with both Project and Task empty. */
function classifyFromDescription(description: string) {
  const { task } = deriveTask("", description);
  const result = classifyProject({ currentProject: "", task, description });
  return { task, ...result };
}

describe("direct prefixes", () => {
  it("OA-1234 => Organic Apply", () => {
    expect(classifyFromDescription("[OA-1234]: Fix inactive partner").project).toBe(PROJECT_NAMES.ORGANIC_APPLY);
  });

  it("WEB-123 => Website Management", () => {
    expect(classifyFromDescription("[WEB-123]: Update homepage banner").project).toBe(
      PROJECT_NAMES.WEBSITE_MANAGEMENT
    );
  });

  it("MOB-123 => Mobile APP", () => {
    expect(classifyFromDescription("[MOB-123]: Fix crash on login").project).toBe(PROJECT_NAMES.MOBILE_APP);
  });

  it("PORTAL-123 => Customer Servicing Portal Web", () => {
    expect(classifyFromDescription("[PORTAL-123]: Update statement view").project).toBe(PROJECT_NAMES.CSP_WEB);
  });

  it("SVP-123 => Security Vulnerabilities", () => {
    expect(classifyFromDescription("[SVP-123]: Patch dependency").project).toBe(
      PROJECT_NAMES.SECURITY_VULNERABILITIES
    );
  });
});

describe("SO-", () => {
  it("SO normal => Loan Servicing Platform", () => {
    expect(classifyFromDescription("[SO-1416]: Fix banner display logic").project).toBe(
      PROJECT_NAMES.LOAN_SERVICING_PLATFORM
    );
  });

  it("SO + Mobile => Mobile APP", () => {
    expect(
      classifyFromDescription(
        "[SO-1416]: All banners in this ticket should be removed 6 months post transfer (Mobile)"
      ).project
    ).toBe(PROJECT_NAMES.MOBILE_APP);
  });

  it("SO + Android Mobile => Mobile APP", () => {
    expect(
      classifyFromDescription("[SO-1553]: Disable cleartextTrafficPermitted on Android Mobile for PROD").project
    ).toBe(PROJECT_NAMES.MOBILE_APP);
  });

  it("SO + CSP => Customer Servicing Portal Web", () => {
    expect(classifyFromDescription("[SO-1547]: Some feature (CSP)").project).toBe(PROJECT_NAMES.CSP_WEB);
  });

  it("SO + contradictory Mobile and CSP signals => review", () => {
    expect(classifyFromDescription("[SO-1600]: Mobile issue also affects CSP Portal").project).toBe("");
  });
});

describe("SRE-", () => {
  it("SRE + Apply => Organic Apply", () => {
    expect(classifyFromDescription("[SRE-100]: Apply flow is broken for new leads").project).toBe(
      PROJECT_NAMES.ORGANIC_APPLY
    );
  });

  it("SRE + CSP => Customer Servicing Portal Web", () => {
    expect(classifyFromDescription("[SRE-101]: CSP Portal login failing").project).toBe(PROJECT_NAMES.CSP_WEB);
  });

  it("SRE sin señal => review", () => {
    const result = classifyFromDescription("[SRE-9427]: [QA][INT]/consumer/v2/leads api is throwing 500");
    expect(result.project).toBe("");
    expect(result.task).toBe("SRE-9427");
  });
});

describe("CAB-", () => {
  it("CAB sin señal => review", () => {
    const result = classifyFromDescription("[CAB-50]: Change request for release window");
    expect(result.project).toBe("");
    expect(result.task).toBe("CAB-50");
  });

  it("CAB + Website => Website Management", () => {
    expect(classifyFromDescription("[CAB-51]: Approve Website change").project).toBe(
      PROJECT_NAMES.WEBSITE_MANAGEMENT
    );
  });
});

describe("OVER-", () => {
  it("OVER sin señal => review, but Task is still populated", () => {
    const result = classifyFromDescription(
      "[OVER-620]: VOS | UI | Loading Screen Sequence & Timeout Handling for Oscilar Processing"
    );
    expect(result.project).toBe("");
    expect(result.task).toBe("OVER-620");
  });

  it("OVER + Mobile => Mobile APP", () => {
    expect(classifyFromDescription("[OVER-621]: Mobile app crashes on submit").project).toBe(
      PROJECT_NAMES.MOBILE_APP
    );
  });

  it("OVER referencing another key uses that key as signal", () => {
    expect(classifyFromDescription("[OVER-999]: Issue related to OA-1234").project).toBe(PROJECT_NAMES.ORGANIC_APPLY);
  });
});

describe("DEP-", () => {
  it("DEP + OA reference => Organic Apply", () => {
    expect(classifyFromDescription("[DEP-500]: OA-100: Deploy new apply form").project).toBe(
      PROJECT_NAMES.ORGANIC_APPLY
    );
  });

  it('DEP + SVP reference + "Deployment to LSP UI app" => Loan Servicing Platform', () => {
    expect(classifyFromDescription("[DEP-512]: [SVP-5093] Deployment to LSP UI app").project).toBe(
      PROJECT_NAMES.LOAN_SERVICING_PLATFORM
    );
  });

  it('DEP + OA reference + "Wordpress Website" => Organic Apply (isolated word does not override the key)', () => {
    const result = classifyFromDescription("[DEP-525]: OA-444: Deployment Wordpress Website");
    expect(result.task).toBe("DEP-525");
    expect(result.project).toBe(PROJECT_NAMES.ORGANIC_APPLY);
  });

  it("DEP with no referenced key and no explicit destination => review", () => {
    expect(classifyFromDescription("[DEP-600]: Weekly deployment").project).toBe("");
  });
});

describe("no recognizable key", () => {
  it("Project and Task both stay empty for manual review", () => {
    const result = classifyFromDescription("Team sync about roadmap priorities");
    expect(result.task).toBe("");
    expect(result.project).toBe("");
  });
});

describe("existing Project / Task are respected", () => {
  it("keeps an already-informed Project untouched", () => {
    const result = classifyProject({
      currentProject: "Some Custom Project",
      task: "OA-1234",
      description: "[OA-1234]: something",
    });
    expect(result).toEqual({ project: "Some Custom Project", confidence: "original" });
  });

  it("keeps an already-informed Task untouched", () => {
    const result = deriveTask("Custom Task Name", "[OA-1234]: something");
    expect(result).toEqual({ task: "Custom Task Name", confidence: "original" });
  });
});
