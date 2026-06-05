/**
 * "How to edit" callout — V1 is read-only. Explains the current edit path
 * (direct DB or `forum.config.json` upload via existing K-01 path) until the
 * V1.1 in-place editor ships.
 *
 * CON-158.
 */
export function HowToEditCallout({ primaryColor }: { primaryColor: string }) {
  return (
    <aside
      className="rounded-lg border bg-white p-5"
      style={{
        borderColor: `${primaryColor}40`,
        backgroundColor: `${primaryColor}08`,
      }}
      aria-labelledby="how-to-edit-heading"
    >
      <h3
        id="how-to-edit-heading"
        className="text-sm font-semibold text-slate-900"
      >
        How to edit
      </h3>
      <p className="mt-2 text-sm text-slate-700">
        This V1 view is read-only. To change your follow-up configuration
        today, do one of:
      </p>
      <ul className="mt-2 space-y-1 text-sm text-slate-700">
        <li className="flex gap-2">
          <span
            className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: primaryColor }}
            aria-hidden
          />
          <span>
            Upload an updated <code className="rounded bg-white px-1 py-0.5 text-xs font-mono border border-slate-200">forum.config.json</code>{" "}
            through the Knowledge → Documents tab (validated against the
            schema on upload).
          </span>
        </li>
        <li className="flex gap-2">
          <span
            className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: primaryColor }}
            aria-hidden
          />
          <span>
            Ask Convo support to edit the configuration directly. Reach out
            via your usual support channel.
          </span>
        </li>
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        An in-place editor is tracked for V1.1. See the schema reference:{" "}
        <a
          href="https://github.com/alfiebmm/convo-app/blob/main/src/lib/forum-config/README.md"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline-offset-2 hover:underline"
        >
          forum-config README
        </a>
        .
      </p>
    </aside>
  );
}
