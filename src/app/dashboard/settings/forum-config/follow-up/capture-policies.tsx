import type { CapturePolicy } from "@/lib/forum-config/schema";
import { Chip } from "./chip";
import { SectionHeading, EmptyHint } from "./section";

const CASE_LABEL: Record<string, string> = {
  cx_support: "CX support",
  lead: "Lead",
};

/**
 * Capture policies — card grid. Read-only.
 *
 * CON-158.
 */
export function CapturePoliciesSection({
  policies,
  primaryColor,
}: {
  policies: CapturePolicy[];
  primaryColor: string;
}) {
  return (
    <section aria-labelledby="capture-policies-heading">
      <SectionHeading
        id="capture-policies-heading"
        primaryColor={primaryColor}
        title="Capture policies"
        description="What the chatbot may collect from a visitor and how it must be disclosed."
        count={policies.length}
      />

      {policies.length === 0 ? (
        <EmptyHint>No capture policies configured.</EmptyHint>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {policies.map((p) => (
            <article
              key={p.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {p.id}
                  </p>
                </div>
                <Chip tone="info">{CASE_LABEL[p.case_type] ?? p.case_type}</Chip>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Required
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.required_fields.length === 0 ? (
                    <span className="text-xs text-slate-400">none</span>
                  ) : (
                    p.required_fields.map((f) => (
                      <Chip key={f} tone="warning">
                        {f}
                      </Chip>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Optional
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.optional_fields.length === 0 ? (
                    <span className="text-xs text-slate-400">none</span>
                  ) : (
                    p.optional_fields.map((f) => (
                      <Chip key={f} tone="neutral">
                        {f}
                      </Chip>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Privacy notice
                </p>
                <p
                  className="mt-1 line-clamp-3 text-xs text-slate-600"
                  title={p.privacy_notice}
                >
                  {p.privacy_notice}
                </p>
              </div>

              <a
                href={p.privacy_policy_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-slate-600 underline-offset-2 hover:underline truncate"
                title={p.privacy_policy_url}
              >
                Privacy policy →
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
