interface ProcessingSummaryProps {
  sourceFileName: string;
  teamCount: number;
  uniqueTaskCount: number;
  alexInitialHours: number;
  pendingCount: number;
  onReviewClick: () => void;
  onDownloadClick: () => void;
  onReset: () => void;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export function ProcessingSummary({
  sourceFileName,
  teamCount,
  uniqueTaskCount,
  alexInitialHours,
  pendingCount,
  onReviewClick,
  onDownloadClick,
  onReset,
}: ProcessingSummaryProps) {
  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-green-700">✓ File processed successfully</p>
          <p className="mt-1 break-all text-xs text-gray-500">{sourceFileName}</p>
        </div>
        <button onClick={onReset} className="shrink-0 text-xs font-medium text-gray-400 hover:text-gray-600">
          Upload another file
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Team entries" value={teamCount} />
        <StatCard label="Unique tasks" value={uniqueTaskCount} />
        <StatCard label="Alex initial hours" value={alexInitialHours} />
        <StatCard label="Needs review" value={pendingCount} />
      </div>

      {pendingCount > 0 && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ⚠ {pendingCount} {pendingCount === 1 ? "activity requires" : "activities require"} manual review before the
          report is complete. You can still download now, but the affected rows will have empty Project and/or Task
          values.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {pendingCount > 0 && (
          <button
            onClick={onReviewClick}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
          >
            Review {pendingCount} pending {pendingCount === 1 ? "item" : "items"}
          </button>
        )}
        <button
          onClick={onDownloadClick}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Download Excel
        </button>
      </div>
    </div>
  );
}
