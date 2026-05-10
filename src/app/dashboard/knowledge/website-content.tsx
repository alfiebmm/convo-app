/**
 * Website Content section (CON-85)
 * 
 * Displays site indexing status with placeholder for re-sync (CON-86).
 */
import Link from "next/link";

interface WebsiteContentProps {
  domain: string | null;
  pagesIndexed: number;
  lastSynced: Date | null;
}

export function WebsiteContent({
  domain,
  pagesIndexed,
  lastSynced,
}: WebsiteContentProps) {
  // Format last synced date
  const formatDate = (date: Date | null) => {
    if (!date) return "Never";
    return new Intl.DateTimeFormat("en-AU", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));
  };

  // Determine status
  const getStatus = () => {
    if (!domain) return { text: "No domain configured", color: "text-slate-500" };
    if (pagesIndexed === 0) return { text: "Not indexed", color: "text-amber-600" };
    return { text: "Indexed", color: "text-emerald-600" };
  };

  const status = getStatus();

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Website Content
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Your website is automatically crawled and indexed for semantic search.
          </p>
        </div>
        
        {/* Re-sync button (disabled, coming in CON-86) */}
        <button
          disabled
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
          title="Re-sync feature coming in K-04 (CON-86)"
        >
          Re-sync
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Domain */}
        <div>
          <dt className="text-sm font-medium text-slate-500">Domain</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-900">
            {domain || (
              <span className="text-sm font-normal text-slate-400">
                Not configured
              </span>
            )}
          </dd>
        </div>

        {/* Pages Indexed */}
        <div>
          <dt className="text-sm font-medium text-slate-500">Pages Indexed</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-900">
            {pagesIndexed.toLocaleString()}
          </dd>
        </div>

        {/* Status */}
        <div>
          <dt className="text-sm font-medium text-slate-500">Status</dt>
          <dd className={`mt-1 text-lg font-semibold ${status.color}`}>
            {status.text}
          </dd>
        </div>
      </div>

      {/* Last Synced */}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-500">
          Last synced: <span className="font-medium text-slate-700">{formatDate(lastSynced)}</span>
        </p>
      </div>

      {/* Info banner for missing domain */}
      {!domain && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            <strong>No domain configured.</strong> Add your website domain in{" "}
            <Link href="/dashboard/settings" className="underline">
              Settings
            </Link>{" "}
            to enable automatic site indexing.
          </p>
        </div>
      )}

      {/* Next steps info */}
      {domain && pagesIndexed > 0 && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            <strong>Indexed successfully!</strong> Re-sync and manual sync
            features are coming in <span className="font-mono">K-04 (CON-86)</span>.
          </p>
        </div>
      )}
    </div>
  );
}
