"use client";

import { useState } from "react";
import { MonthlyReport } from "@/components/monthly-report";
import { WeeklyReport } from "@/components/weekly-report";

type ReportMode = "weekly" | "monthly";

export default function Home() {
  const [mode, setMode] = useState<ReportMode>("weekly");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900">LP Clockify Report Processor</h1>
        <p className="mt-2 text-sm text-gray-500">
          {mode === "weekly"
            ? "Upload your Clockify detailed report to generate the weekly LendingPoint report."
            : "Upload finalized weekly LendingPoint reports to consolidate them into a monthly report."}
        </p>
      </div>

      <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        <button
          onClick={() => setMode("weekly")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === "weekly" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Weekly Report
        </button>
        <button
          onClick={() => setMode("monthly")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === "monthly" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Monthly Report
        </button>
      </div>

      {mode === "weekly" ? <WeeklyReport /> : <MonthlyReport />}
    </div>
  );
}
