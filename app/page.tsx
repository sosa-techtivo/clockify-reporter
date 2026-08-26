"use client";

import { useMemo, useState } from "react";
import { FileDropzone } from "@/components/file-dropzone";
import { ProcessingSummary } from "@/components/processing-summary";
import { ReviewPending } from "@/components/review-pending";
import { ClockifyParseError, parseClockifyFile } from "@/lib/clockify/parser";
import { runProcessingPipeline } from "@/lib/clockify/run-pipeline";
import { applyPendingCorrection, buildPendingGroups } from "@/lib/clockify/pending";
import { validateProcessing } from "@/lib/clockify/validations";
import { buildExportFileName, buildExportWorkbook, downloadWorkbook } from "@/lib/clockify/exporter";
import { ProcessedRow, RawClockifyRow } from "@/lib/clockify/types";

type View = "upload" | "summary" | "review";

export default function Home() {
  const [view, setView] = useState<View>("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportErrors, setExportErrors] = useState<string[] | null>(null);

  const [sourceFileName, setSourceFileName] = useState<string>("");
  const [rawRows, setRawRows] = useState<RawClockifyRow[]>([]);
  const [rows, setRows] = useState<ProcessedRow[]>([]);
  const [initialAlexCount, setInitialAlexCount] = useState(0);
  const [initialUniqueTaskCount, setInitialUniqueTaskCount] = useState(0);

  const teamRows = useMemo(() => rows.filter((r) => !r.isAlexRow), [rows]);
  const alexRows = useMemo(() => rows.filter((r) => r.isAlexRow), [rows]);
  const pendingGroups = useMemo(() => buildPendingGroups(rows), [rows]);

  async function handleFileSelected(file: File) {
    setError(null);
    setExportErrors(null);
    setIsProcessing(true);
    try {
      const parsed = await parseClockifyFile(file);
      const result = runProcessingPipeline(parsed.rows);
      setRawRows(parsed.rows);
      setSourceFileName(parsed.sourceFileName);
      setRows([...result.teamRows, ...result.alexRows]);
      setInitialAlexCount(result.alexRows.length);
      setInitialUniqueTaskCount(result.uniqueTaskCount);
      setView("summary");
    } catch (e) {
      setError(e instanceof ClockifyParseError ? e.message : "Unexpected error while processing the file. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }

  function handleApplyCorrection(groupKey: string, project?: string, task?: string) {
    setRows((prev) => applyPendingCorrection(prev, groupKey, { project, task }));
  }

  function handleDownload() {
    const validation = validateProcessing(rawRows, teamRows, alexRows);
    if (!validation.valid) {
      setExportErrors(validation.errors);
      return;
    }
    setExportErrors(null);
    const workbook = buildExportWorkbook(rows);
    downloadWorkbook(workbook, buildExportFileName(sourceFileName));
  }

  function handleReset() {
    setView("upload");
    setError(null);
    setExportErrors(null);
    setSourceFileName("");
    setRawRows([]);
    setRows([]);
    setInitialAlexCount(0);
    setInitialUniqueTaskCount(0);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900">LP Clockify Report Processor</h1>
        <p className="mt-2 text-sm text-gray-500">
          Upload your Clockify detailed report to generate the weekly LendingPoint report.
        </p>
      </div>

      {view === "upload" && (
        <>
          <FileDropzone onFileSelected={handleFileSelected} disabled={isProcessing} />
          {error && <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </>
      )}

      {view === "summary" && (
        <ProcessingSummary
          sourceFileName={sourceFileName}
          teamCount={teamRows.length}
          uniqueTaskCount={initialUniqueTaskCount}
          alexInitialHours={initialAlexCount}
          pendingCount={pendingGroups.length}
          onReviewClick={() => setView("review")}
          onDownloadClick={handleDownload}
          onReset={handleReset}
        />
      )}

      {view === "review" && (
        <ReviewPending pendingGroups={pendingGroups} onApply={handleApplyCorrection} onBack={() => setView("summary")} />
      )}

      {exportErrors && exportErrors.length > 0 && (
        <div className="w-full rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">The Excel file could not be generated because of a data integrity check:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {exportErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
