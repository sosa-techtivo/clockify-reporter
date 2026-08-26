import { DIRECT_PREFIX_PROJECT, PROJECT_NAMES, TicketPrefix } from "./constants";
import {
  SIGNALS,
  extractPrefixFromTask,
  findExplicitDeploymentDestinationPhrase,
  findPrimaryTicketKey,
  findReferencedTicketKeys,
} from "./ticket-parser";
import { ClassificationResult, TaskDerivationResult } from "./types";

/** Rule 4 — Task. Respects an existing Task; otherwise derives it from the primary
 * ticket key found in the Description. Leaves it empty when no key is recognizable. */
export function deriveTask(originalTask: string, description: string): TaskDerivationResult {
  if (originalTask && originalTask.trim() !== "") {
    return { task: originalTask, confidence: "original" };
  }
  const primary = findPrimaryTicketKey(description);
  if (primary) {
    return { task: primary.key, confidence: "derived" };
  }
  return { task: "", confidence: "none" };
}

function classifySO(description: string): ClassificationResult {
  const mobile = SIGNALS.mobile.test(description);
  const csp = SIGNALS.csp.test(description);
  if (mobile && csp) return { project: "", confidence: "review" };
  if (mobile) return { project: PROJECT_NAMES.MOBILE_APP, confidence: "automatic" };
  if (csp) return { project: PROJECT_NAMES.CSP_WEB, confidence: "automatic" };
  return { project: PROJECT_NAMES.LOAN_SERVICING_PLATFORM, confidence: "automatic" };
}

/** Shared signal-based classifier for SRE / CAB, and as a fallback for OVER. */
function classifyBySignals(description: string, includeLsp: boolean): ClassificationResult {
  const candidates = new Set<string>();
  if (SIGNALS.apply.test(description)) candidates.add(PROJECT_NAMES.ORGANIC_APPLY);
  if (SIGNALS.website.test(description)) candidates.add(PROJECT_NAMES.WEBSITE_MANAGEMENT);
  if (SIGNALS.mobile.test(description)) candidates.add(PROJECT_NAMES.MOBILE_APP);
  if (SIGNALS.csp.test(description)) candidates.add(PROJECT_NAMES.CSP_WEB);
  if (includeLsp && SIGNALS.lsp.test(description)) candidates.add(PROJECT_NAMES.LOAN_SERVICING_PLATFORM);

  if (candidates.size === 1) {
    return { project: [...candidates][0], confidence: "automatic" };
  }
  return { project: "", confidence: "review" };
}

/** Resolves a project from a single ticket prefix, when that prefix maps unambiguously
 * on its own (direct prefixes, or SO using its own signal rules). Returns null for
 * prefixes whose classification itself depends on further context (SRE/CAB/OVER/DEP). */
function resolveDirectOrSO(prefix: TicketPrefix, description: string): string | null {
  const direct = DIRECT_PREFIX_PROJECT[prefix];
  if (direct) return direct;
  if (prefix === "SO") {
    const result = classifySO(description);
    return result.confidence === "review" ? null : result.project;
  }
  return null;
}

function classifyOver(description: string): ClassificationResult {
  const referenced = findReferencedTicketKeys(description);
  if (referenced.length > 0) {
    const resolved = resolveDirectOrSO(referenced[0].prefix, description);
    if (resolved) return { project: resolved, confidence: "automatic" };
  }
  return classifyBySignals(description, true);
}

function classifyDep(description: string): ClassificationResult {
  const referenced = findReferencedTicketKeys(description);
  const baseProject = referenced.length > 0 ? resolveDirectOrSO(referenced[0].prefix, description) : null;

  const destinationPhrase = findExplicitDeploymentDestinationPhrase(description);
  let destinationProject: string | null = null;
  if (destinationPhrase) {
    const destinationCandidates = new Set<string>();
    if (SIGNALS.lsp.test(destinationPhrase)) destinationCandidates.add(PROJECT_NAMES.LOAN_SERVICING_PLATFORM);
    if (SIGNALS.csp.test(destinationPhrase)) destinationCandidates.add(PROJECT_NAMES.CSP_WEB);
    if (SIGNALS.mobile.test(destinationPhrase)) destinationCandidates.add(PROJECT_NAMES.MOBILE_APP);
    if (SIGNALS.website.test(destinationPhrase)) destinationCandidates.add(PROJECT_NAMES.WEBSITE_MANAGEMENT);
    if (SIGNALS.apply.test(destinationPhrase)) destinationCandidates.add(PROJECT_NAMES.ORGANIC_APPLY);
    if (destinationCandidates.size === 1) destinationProject = [...destinationCandidates][0];
  }

  if (destinationProject && destinationProject !== baseProject) {
    return { project: destinationProject, confidence: "automatic" };
  }
  if (baseProject) {
    return { project: baseProject, confidence: "automatic" };
  }
  if (destinationProject) {
    return { project: destinationProject, confidence: "automatic" };
  }
  return { project: "", confidence: "review" };
}

/** Rules 5–12 — Project. Only runs when Project is empty; the caller is expected to
 * short-circuit and keep the original value otherwise. `task` must already be resolved
 * (original or derived) so its prefix can drive classification. */
export function classifyProject(input: {
  currentProject: string;
  task: string;
  description: string;
}): ClassificationResult {
  if (input.currentProject && input.currentProject.trim() !== "") {
    return { project: input.currentProject, confidence: "original" };
  }

  if (!input.task || input.task.trim() === "") {
    // Rule 12 — no key anywhere: nothing to classify from, leave for manual review.
    return { project: "", confidence: "review" };
  }

  const prefix = extractPrefixFromTask(input.task);
  if (!prefix) {
    return { project: "", confidence: "review" };
  }

  switch (prefix) {
    case "OA":
    case "WEB":
    case "MOB":
    case "PORTAL":
    case "SVP":
      return { project: DIRECT_PREFIX_PROJECT[prefix]!, confidence: "automatic" };
    case "SO":
      return classifySO(input.description);
    case "SRE":
    case "CAB":
      return classifyBySignals(input.description, false);
    case "OVER":
      return classifyOver(input.description);
    case "DEP":
      return classifyDep(input.description);
    default:
      return { project: "", confidence: "review" };
  }
}
