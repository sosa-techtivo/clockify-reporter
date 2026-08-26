import { TICKET_PREFIXES, TicketPrefix } from "./constants";

export interface TicketKeyMatch {
  prefix: TicketPrefix;
  number: string;
  key: string;
  index: number;
}

const TICKET_KEY_REGEX = new RegExp(`\\b(${TICKET_PREFIXES.join("|")})-(\\d+)\\b`, "gi");

/** Finds every recognizable ticket key inside a description, in order of appearance. */
export function findAllTicketKeys(description: string): TicketKeyMatch[] {
  if (!description) return [];
  const matches: TicketKeyMatch[] = [];
  const regex = new RegExp(TICKET_KEY_REGEX.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = regex.exec(description)) !== null) {
    const prefix = m[1].toUpperCase() as TicketPrefix;
    matches.push({
      prefix,
      number: m[2],
      key: `${prefix}-${m[2]}`,
      index: m.index,
    });
  }
  return matches;
}

/** The primary ticket (first key mentioned) — used as Task when Task is empty. */
export function findPrimaryTicketKey(description: string): TicketKeyMatch | null {
  const matches = findAllTicketKeys(description);
  return matches.length > 0 ? matches[0] : null;
}

/** Keys referenced in the description besides the primary one (e.g. DEP-525: OA-444: ...). */
export function findReferencedTicketKeys(description: string): TicketKeyMatch[] {
  const matches = findAllTicketKeys(description);
  return matches.slice(1);
}

/** Extracts the prefix portion of a "PREFIX-1234" task string, or null if it doesn't match. */
export function extractPrefixFromTask(task: string): TicketPrefix | null {
  if (!task) return null;
  const m = task.trim().match(new RegExp(`^(${TICKET_PREFIXES.join("|")})-\\d+$`, "i"));
  return m ? (m[1].toUpperCase() as TicketPrefix) : null;
}

/** Unambiguous textual signals used to disambiguate SO / SRE / CAB / OVER / DEP tickets. */
export const SIGNALS = {
  mobile: /\bmobile\b/i,
  csp: /\bcsp\b|\bcustomer\s+servicing\s+portal\b/i,
  apply: /\bapply\b/i,
  website: /\bwebsite\b/i,
  lsp: /\blsp\b|\bloan\s+servicing\s+platform\b/i,
};

/** Looks for an explicit "deployment to <destination>" phrase and resolves the destination
 * system from it. Returns null when no such explicit phrase exists, so isolated keywords
 * elsewhere in the description never accidentally override a key-based classification. */
export function findExplicitDeploymentDestinationPhrase(description: string): string | null {
  if (!description) return null;
  const m = description.match(/deploy(?:ment|ing)?[^.;]{0,10}\bto\b([^.;]{0,60})/i);
  return m ? m[1] : null;
}
