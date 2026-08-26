import { PendingGroup } from "@/lib/clockify/types";
import { PendingItem } from "./pending-item";

interface ReviewPendingProps {
  pendingGroups: PendingGroup[];
  onApply: (groupKey: string, project?: string, task?: string) => void;
  onBack: () => void;
}

export function ReviewPending({ pendingGroups, onApply, onBack }: ReviewPendingProps) {
  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Review pending items</h2>
        <button onClick={onBack} className="text-xs font-medium text-gray-400 hover:text-gray-600">
          ← Back to summary
        </button>
      </div>

      {pendingGroups.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">All pending items have been resolved.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {pendingGroups.map((group) => (
            <PendingItem
              key={group.groupKey}
              group={group}
              onApply={(project, task) => onApply(group.groupKey, project, task)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
