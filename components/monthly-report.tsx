"use client";

import { useMemo, useState } from "react";
import { MonthlyDropzone } from "@/components/monthly-dropzone";
import { MonthlySummaryView } from "@/components/monthly-summary";
import { concatenateMonthlyRows, sortRowsByProject } from "@/lib/clockify/monthly/consolidate";
import { applyNsMapping, findUnknownProjects, getKnownNsCodes, NsOverrides } from "@/lib/clockify/monthly/ns-mapping";
import { MonthlyParseError, parseMonthlySourceFile } from "@/lib/clockify/monthly/parser";
import { buildMonthlySummary } from "@/lib/clockify/monthly/summary";
import { downloadMonthlyWorkbook } from "@/lib/clockify/monthly/template/download";
import { buildMonthlyOutputFileName } from "@/lib/clockify/monthly/template/filename";
import { buildMonthlyWorkbookZip, MonthlyTemplateError } from "@/lib/clockify/monthly/template/generate-workbook";
import { fetchMonthlyTemplateBytes } from "@/lib/clockify/monthly/template/template-source";
import { MonthlyFileParseResult } from "@/lib/clockify/monthly/types";
import { validateMonthlyFiles } from "@/lib/clockify/monthly/validate";

interface StagedFile {
  file: File;
  result: MonthlyFileParseResult | null;
  parseError: string | null;
}

/** Monthly Report: multi-file ingestion of finalized weekly reports, cross-file
 * validation, concatenation + Project sort, and NS mapping (with review for unknown
 * Projects), then Continue/Generate ZIP/OOXML-patches the July reference template into a
 * downloadable .xlsx with a real, refreshable native PivotTable (lib/clockify/monthly/template).
 * Kept fully separate from the Weekly Report flow: no shared state, no shared components
 * beyond styling conventions, and no SheetJS involvement in the generated file at all. */
export function MonthlyReport() {
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nsOverrides, setNsOverrides] = useState<NsOverrides>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedFileName, setGeneratedFileName] = useState<string | null>(null);

  async function handleFilesAdded(files: File[]) {
    setIsProcessing(true);
    setGeneratedFileName(null);
    setGenerateError(null);
    const entries: StagedFile[] = [];
    for (const file of files) {
      try {
        const result = await parseMonthlySourceFile(file);
        entries.push({ file, result, parseError: null });
      } catch (e) {
        entries.push({
          file,
          result: null,
          parseError: e instanceof MonthlyParseError ? e.message : "Unexpected error while reading this file.",
        });
      }
    }
    setStaged((prev) => [...prev, ...entries]);
    setIsProcessing(false);
  }

  function handleRemoveFile(index: number) {
    setStaged((prev) => prev.filter((_, i) => i !== index));
    setGeneratedFileName(null);
    setGenerateError(null);
  }

  function handleAssignNs(project: string, ns: string) {
    setNsOverrides((prev) => ({ ...prev, [project]: ns }));
    setGeneratedFileName(null);
    setGenerateError(null);
  }

  function handleReset() {
    setStaged([]);
    setNsOverrides({});
    setGeneratedFileName(null);
    setGenerateError(null);
  }

  const parsedResults = useMemo(() => staged.filter((s): s is StagedFile & { result: MonthlyFileParseResult } => s.result !== null).map((s) => s.result), [staged]);
  const hardParseErrors = useMemo(
    () => staged.filter((s) => s.parseError !== null).map((s) => `"${s.file.name}": ${s.parseError}`),
    [staged]
  );

  const validation = useMemo(() => validateMonthlyFiles(parsedResults), [parsedResults]);
  const consolidatedRaw = useMemo(() => sortRowsByProject(concatenateMonthlyRows(parsedResults)), [parsedResults]);
  const unknownProjects = useMemo(() => findUnknownProjects(consolidatedRaw, nsOverrides), [consolidatedRaw, nsOverrides]);
  const summary = useMemo(
    () => buildMonthlySummary(parsedResults, validation, unknownProjects, hardParseErrors),
    [parsedResults, validation, unknownProjects, hardParseErrors]
  );
  // The final Project|Client|Description|Task|User|Duration|NS row set fed to
  // buildMonthlyWorkbookZip as the new Detailed Report on Generate.
  const consolidatedWithNs = useMemo(() => applyNsMapping(consolidatedRaw, nsOverrides), [consolidatedRaw, nsOverrides]);
  const knownNsCodes = useMemo(() => getKnownNsCodes(nsOverrides), [nsOverrides]);

  const canContinue = staged.length > 0 && summary.validationErrors.length === 0 && summary.unknownProjects.length === 0;

  async function handleGenerate() {
    if (!summary.coverageStart || !summary.coverageEnd) return;
    setIsGenerating(true);
    setGenerateError(null);
    setGeneratedFileName(null);
    try {
      const templateBytes = await fetchMonthlyTemplateBytes();
      const zipBytes = buildMonthlyWorkbookZip(templateBytes, consolidatedWithNs);
      const fileName = buildMonthlyOutputFileName(summary.coverageStart, summary.coverageEnd);
      downloadMonthlyWorkbook(zipBytes, fileName);
      setGeneratedFileName(fileName);
    } catch (e) {
      setGenerateError(e instanceof MonthlyTemplateError ? e.message : "Unexpected error while generating the Monthly Report. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <MonthlyDropzone onFilesAdded={handleFilesAdded} disabled={isProcessing} />

      {staged.length > 0 && (
        <MonthlySummaryView
          fileNames={staged.map((s) => s.file.name)}
          onRemoveFile={handleRemoveFile}
          summary={summary}
          knownNsCodes={knownNsCodes}
          nsOverrides={nsOverrides}
          onAssignNs={handleAssignNs}
          canContinue={canContinue}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          generateError={generateError}
          generatedFileName={generatedFileName}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
