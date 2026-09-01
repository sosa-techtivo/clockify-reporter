"use client";

import { useState } from "react";
import { formatIsoDate } from "@/lib/clockify/monthly/date";
import { NsOverrides } from "@/lib/clockify/monthly/ns-mapping";
import { MonthlySummary } from "@/lib/clockify/monthly/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function UnknownProjectRow({
  project,
  knownNsCodes,
  onAssign,
}: {
  project: string;
  knownNsCodes: string[];
  onAssign: (ns: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const [customNs, setCustomNs] = useState("");
  const isCustom = selected === "__custom__";
  const value = isCustom ? customNs.trim() : selected;
  const canApply = value !== "";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-medium text-gray-900">{project}</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm sm:w-auto"
        >
          <option value="">Select NS…</option>
          {knownNsCodes.map((ns) => (
            <option key={ns} value={ns}>
              {ns}
            </option>
          ))}
          <option value="__custom__">Enter new NS…</option>
        </select>
        {isCustom && (
          <input
            type="text"
            value={customNs}
            onChange={(e) => setCustomNs(e.target.value)}
            placeholder="e.g. NS-700"
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm sm:w-auto"
          />
        )}
        <button
          onClick={() => canApply && onAssign(value)}
          disabled={!canApply}
          className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Apply to all rows
        </button>
      </div>
    </div>
  );
}

interface MonthlySummaryViewProps {
  fileNames: string[];
  onRemoveFile: (index: number) => void;
  summary: MonthlySummary;
  knownNsCodes: string[];
  nsOverrides: NsOverrides;
  onAssignNs: (project: string, ns: string) => void;
  canContinue: boolean;
  onGenerate: () => void;
  isGenerating: boolean;
  generateError: string | null;
  generatedFileName: string | null;
  onReset: () => void;
}

export function MonthlySummaryView({
  fileNames,
  onRemoveFile,
  summary,
  knownNsCodes,
  onAssignNs,
  canContinue,
  onGenerate,
  isGenerating,
  generateError,
  generatedFileName,
  onReset,
}: MonthlySummaryViewProps) {
  const monthLabel = summary.detectedMonth
    ? `${MONTH_NAMES[summary.detectedMonth.month - 1]} ${summary.detectedMonth.year}`
    : "—";
  const coverageLabel =
    summary.coverageStart && summary.coverageEnd
      ? `${formatIsoDate(summary.coverageStart)} → ${formatIsoDate(summary.coverageEnd)}`
      : "—";

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold text-gray-900">Monthly Report — pre-generation summary</h2>
        <button onClick={onReset} className="shrink-0 text-xs font-medium text-gray-400 hover:text-gray-600">
          Start over
        </button>
      </div>

      {fileNames.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1">
          {fileNames.map((name, index) => (
            <li key={`${name}-${index}`} className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
              <span className="break-all">{name}</span>
              <button onClick={() => onRemoveFile(index)} className="shrink-0 font-medium text-gray-400 hover:text-red-600">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Detected month" value={monthLabel} />
        <StatCard label="Files loaded" value={summary.filesLoaded} />
        <StatCard label="Coverage" value={coverageLabel} />
        <StatCard label="Total source rows" value={summary.totalSourceRows} />
        <StatCard label="Unknown Project/NS" value={summary.unknownProjects.length} />
        <StatCard label="Validation errors" value={summary.validationErrors.length} />
      </div>

      {summary.validationErrors.length > 0 && (
        <div className="mt-5 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">Monthly generation is blocked until these are resolved:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {summary.validationErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.unknownProjects.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-medium text-gray-900">Unknown Project → NS mappings</p>
          <p className="mt-1 text-xs text-gray-500">
            These Projects aren&apos;t in the base NS mapping. Assign an NS to unblock generation — it applies to every row
            of that Project in this monthly report only (not saved).
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {summary.unknownProjects.map((project) => (
              <UnknownProjectRow
                key={project}
                project={project}
                knownNsCodes={knownNsCodes}
                onAssign={(ns) => onAssignNs(project, ns)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <button
          onClick={onGenerate}
          disabled={!canContinue || isGenerating}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isGenerating ? "Generating…" : "Continue / Generate"}
        </button>
        {!canContinue && (
          <p className="mt-2 text-xs text-gray-500">Resolve the blocking items above to continue.</p>
        )}
      </div>

      {generateError && (
        <div className="mt-5 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">The Monthly Report could not be generated:</p>
          <p className="mt-1">{generateError}</p>
        </div>
      )}

      {generatedFileName && !isGenerating && !generateError && (
        <div className="mt-5 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          <p className="font-medium">✓ Downloaded {generatedFileName} — {summary.totalSourceRows} row(s), NS mapped.</p>
          <p className="mt-1 text-green-700">
            Open it in Microsoft Excel and use Data → Refresh All if the PivotTable doesn&apos;t populate automatically.
          </p>
        </div>
      )}
    </div>
  );
}
