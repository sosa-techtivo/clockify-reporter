/**
 * Fixed Project -> NS mapping used to populate the Monthly Report's NS column.
 * Bump NS_MAPPING_VERSION whenever BASE_PROJECT_NS_MAP changes, so a mismatch between a
 * generated report and the mapping that produced it is at least detectable later.
 */
export const NS_MAPPING_VERSION = 2;

/** Seeded from the July 2026 reference report (reference/Clockify_Julio_2026.xlsx), plus
 * mappings added afterward as real monthly data surfaced new Project names. */
export const BASE_PROJECT_NS_MAP: Readonly<Record<string, string>> = Object.freeze({
  Automations: "NS-645",
  "Change Advisory Board": "NS-644",
  "Customer Servicing Portal Web": "NS-419",
  "Loan Servicing Platform": "NS-613",
  "Mobile APP": "NS-419",
  "Organic Apply": "NS-644",
  "Security Vulnerabilities": "NS-291",
  "Website Management": "NS-412",
  // Added v2 — real August 2026 data surfaced this as a distinct Project name from
  // "Security Vulnerabilities" above, sharing the same NS code.
  "Application Security Vulnerabilities": "NS-291",
});

export type NsOverrides = Record<string, string>;

/** Every NS code Alex can pick from a dropdown without typing a new one: the base map's
 * codes plus whatever's already been assigned this session. */
export function getKnownNsCodes(overrides: NsOverrides = {}): string[] {
  return [...new Set([...Object.values(BASE_PROJECT_NS_MAP), ...Object.values(overrides)])].sort();
}

export function resolveNs(project: string, overrides: NsOverrides): string | undefined {
  return overrides[project] ?? BASE_PROJECT_NS_MAP[project];
}

/** Distinct Projects present in `rows` that have no NS yet — from the base map or from a
 * session override — in alphabetical order. Empty means nothing is blocking generation. */
export function findUnknownProjects(rows: { project: string }[], overrides: NsOverrides): string[] {
  const distinct = new Set(rows.map((r) => r.project));
  return [...distinct].filter((project) => resolveNs(project, overrides) === undefined).sort((a, b) => a.localeCompare(b));
}

/** Stamps the resolved NS onto every row. Rows whose Project still has no mapping get an
 * empty NS string — callers must gate generation on findUnknownProjects() being empty
 * first, this function itself never blocks. */
export function applyNsMapping<T extends { project: string }>(rows: T[], overrides: NsOverrides): (T & { ns: string })[] {
  return rows.map((row) => ({ ...row, ns: resolveNs(row.project, overrides) ?? "" }));
}
