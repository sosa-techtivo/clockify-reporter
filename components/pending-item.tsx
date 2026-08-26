"use client";

import { useState } from "react";
import { SELECTABLE_PROJECTS } from "@/lib/clockify/constants";
import { PendingGroup } from "@/lib/clockify/types";

interface PendingItemProps {
  group: PendingGroup;
  onApply: (project?: string, task?: string) => void;
}

export function PendingItem({ group, onApply }: PendingItemProps) {
  const [project, setProject] = useState("");
  const [task, setTask] = useState("");

  const canApply = (!group.missingProject || project !== "") && (!group.missingTask || task.trim() !== "");

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-sm font-semibold text-gray-900">{group.task || "(no ticket key)"}</p>
        <p className="text-xs text-gray-500">
          Affects {group.affectedTeamCount} team {group.affectedTeamCount === 1 ? "record" : "records"}
          {group.affectedAlexCount > 0 &&
            `, ${group.affectedAlexCount} Alex ${group.affectedAlexCount === 1 ? "record" : "records"}`}
        </p>
      </div>
      <p className="mt-1 text-sm text-gray-600">{group.description}</p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        {group.missingTask && (
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">Task</label>
            <input
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="e.g. OA-1234"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        )}
        {group.missingProject && (
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">Project</label>
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Select project</option>
              {SELECTABLE_PROJECTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          onClick={() => onApply(group.missingProject ? project : undefined, group.missingTask ? task : undefined)}
          disabled={!canApply}
          className="shrink-0 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
