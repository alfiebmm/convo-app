import type { Destination } from "@/lib/forum-config/schema";
import { Chip } from "./chip";
import { SectionHeading, EmptyHint } from "./section";

const CONNECTOR_LABEL: Record<Destination["connector"], string> = {
  webhook: "Webhook",
  csv_export: "CSV export",
};

const CASE_LABEL: Record<string, string> = {
  cx_support: "CX support",
  lead: "Lead",
};

/**
 * Destinations — card grid. Read-only.
 *
 * Shows: id, case_type, connector type, routing_key. Config payload is
 * intentionally omitted from V1 (may contain secrets). V1.1 editor will
 * surface a redacted view.
 *
 * CON-158.
 */
export function DestinationsSection({
  destinations,
  primaryColor,
}: {
  destinations: Destination[];
  primaryColor: string;
}) {
  return (
    <section aria-labelledby="destinations-heading">
      <SectionHeading
        id="destinations-heading"
        primaryColor={primaryColor}
        title="Destinations"
        description="Where captured leads and CX cases are delivered."
        count={destinations.length}
      />

      {destinations.length === 0 ? (
        <EmptyHint>No destinations configured.</EmptyHint>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {destinations.map((d) => (
            <article
              key={d.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {d.id}
                </p>
                <Chip tone="info">{CONNECTOR_LABEL[d.connector]}</Chip>
              </div>

              <div className="flex flex-wrap gap-1">
                <Chip tone="neutral">
                  {CASE_LABEL[d.case_type] ?? d.case_type}
                </Chip>
              </div>

              <p className="text-xs text-slate-600">
                <span className="text-slate-500">routing:</span>{" "}
                <span className="font-mono">{d.routing_key}</span>
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
