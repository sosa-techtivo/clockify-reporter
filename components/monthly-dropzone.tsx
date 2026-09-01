"use client";

import { useRef, useState } from "react";

interface MonthlyDropzoneProps {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
}

/** Multi-file variant of FileDropzone, kept separate since the Monthly flow needs to
 * accumulate many finalized weekly files (dropped/selected across multiple interactions)
 * instead of replacing a single file each time. */
export function MonthlyDropzone({ onFilesAdded, disabled }: MonthlyDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) onFilesAdded(files);
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) onFilesAdded(files);
    event.target.value = "";
  }

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors ${
          disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
            : isDragOver
              ? "cursor-pointer border-blue-500 bg-blue-50"
              : "cursor-pointer border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/50"
        }`}
      >
        <svg
          className="h-10 w-10 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0-3 3m3-3 3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
        </svg>
        <p className="text-sm font-medium text-gray-700">
          {disabled ? "Processing…" : "Drag & drop your finalized weekly Excel reports here"}
        </p>
        <p className="text-xs text-gray-500">or click to browse — you can select multiple .xlsx files</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={handleInputChange}
          disabled={disabled}
        />
      </div>
      <p className="mt-3 text-center text-xs text-gray-400">
        Files are processed locally in your browser and are not uploaded.
      </p>
    </div>
  );
}
