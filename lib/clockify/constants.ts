/**
 * Centralized names, prefixes and column definitions for the Clockify
 * report processing pipeline. Keep every user-facing string that has
 * business meaning here so it is never duplicated across the codebase.
 */

export const PROJECT_NAMES = {
  ORGANIC_APPLY: "Organic Apply",
  LOAN_SERVICING_PLATFORM: "Loan Servicing Platform",
  MOBILE_APP: "Mobile APP",
  CSP_WEB: "Customer Servicing Portal Web",
  WEBSITE_MANAGEMENT: "Website Management",
  SECURITY_VULNERABILITIES: "Security Vulnerabilities",
} as const;

export type ProjectName = (typeof PROJECT_NAMES)[keyof typeof PROJECT_NAMES];

/** Selectable project options shown in the manual-review dropdown. */
export const SELECTABLE_PROJECTS: ProjectName[] = [
  PROJECT_NAMES.ORGANIC_APPLY,
  PROJECT_NAMES.LOAN_SERVICING_PLATFORM,
  PROJECT_NAMES.MOBILE_APP,
  PROJECT_NAMES.CSP_WEB,
  PROJECT_NAMES.WEBSITE_MANAGEMENT,
  PROJECT_NAMES.SECURITY_VULNERABILITIES,
];

export const CLIENT_NAME = "LendingPoint";

export const ALEX_USER_NAME = "Alex Sosa";

/** Ticket key prefixes recognized inside Description / Task. */
export const TICKET_PREFIXES = [
  "OA",
  "WEB",
  "MOB",
  "PORTAL",
  "SVP",
  "SRE",
  "DEP",
  "CAB",
  "OVER",
  "SO",
] as const;

export type TicketPrefix = (typeof TICKET_PREFIXES)[number];

/** Prefixes that map to exactly one project, regardless of context. */
export const DIRECT_PREFIX_PROJECT: Partial<Record<TicketPrefix, ProjectName>> = {
  OA: PROJECT_NAMES.ORGANIC_APPLY,
  WEB: PROJECT_NAMES.WEBSITE_MANAGEMENT,
  MOB: PROJECT_NAMES.MOBILE_APP,
  PORTAL: PROJECT_NAMES.CSP_WEB,
  SVP: PROJECT_NAMES.SECURITY_VULNERABILITIES,
};

/** Final export column headers, in the required order. */
export const EXPORT_COLUMNS = [
  "Project",
  "Client",
  "Description",
  "Task",
  "User",
  "Duration (decimal)",
] as const;

export type ExportColumn = (typeof EXPORT_COLUMNS)[number];

/** Candidate header names found in raw Clockify exports, mapped to our internal fields. */
export const SOURCE_COLUMN_ALIASES: Record<string, "project" | "client" | "description" | "task" | "user" | "duration"> = {
  Project: "project",
  Client: "client",
  Description: "description",
  Task: "task",
  User: "user",
  "Duration (decimal)": "duration",
};
