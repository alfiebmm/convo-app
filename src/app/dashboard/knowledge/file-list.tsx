"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FileStatus = "pending" | "processing" | "indexed" | "failed";

interface KnowledgeFile {
  id: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  status: FileStatus;
  uploadedAt: Date;
  indexedAt: Date | null;
  errorMessage: string | null;
  chunksIndexed: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusPill({ status }: { status: FileStatus }) {
  const colors = {
    pending: "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    indexed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };

  const labels = {
    pending: "Pending",
    processing: "Processing",
    indexed: "Indexed",
    failed: "Failed",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function FileRow({ file }: { file: KnowledgeFile }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(`Delete "${file.originalFilename}"?`)) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/knowledge/files/${file.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Delete failed");
      }

      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      alert(`Error: ${message}`);
      setIsDeleting(false);
    }
  };

  return (
    <tr className="border-b border-slate-200 hover:bg-slate-50">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">📄</span>
          <div>
            <div className="text-sm font-medium text-slate-900">
              {file.originalFilename}
            </div>
            <div className="text-xs text-slate-500">
              {formatFileSize(file.byteSize)} • Uploaded{" "}
              {formatDate(file.uploadedAt)}
            </div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <StatusPill status={file.status} />
      </td>
      <td className="py-3 px-4 text-sm text-slate-600">
        {file.status === "indexed" ? (
          <span>{file.chunksIndexed} chunks</span>
        ) : file.status === "failed" ? (
          <span className="text-red-600 text-xs">
            {file.errorMessage || "Unknown error"}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </td>
    </tr>
  );
}

export function FileList({ files }: { files: KnowledgeFile[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              File
            </th>
            <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Status
            </th>
            <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Chunks
            </th>
            <th className="py-3 px-4"></th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <FileRow key={file.id} file={file} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
