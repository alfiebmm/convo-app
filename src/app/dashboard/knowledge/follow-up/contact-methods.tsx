import type { ContactMethod } from "@/lib/forum-config/schema";
import { Chip } from "./chip";
import { SectionHeading, EmptyHint } from "./section";

const TYPE_LABEL: Record<ContactMethod["type"], string> = {
  email: "Email",
  phone: "Phone",
  callback: "Callback",
  url: "URL",
  form: "Form",
};

const CASE_LABEL: Record<string, string> = {
  cx_support: "CX support",
  lead: "Lead",
};

/**
 * Contact methods — card grid. Read-only.
 *
 * CON-158.
 */
export function ContactMethodsSection({
  methods,
  primaryColor,
}: {
  methods: ContactMethod[];
  primaryColor: string;
}) {
  return (
    <section aria-labelledby="contact-methods-heading">
      <SectionHeading
        id="contact-methods-heading"
        primaryColor={primaryColor}
        title="Contact methods"
        description="Approved channels the chatbot may refer visitors to."
        count={methods.length}
      />

      {methods.length === 0 ? (
        <EmptyHint>No contact methods configured.</EmptyHint>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {methods.map((cm) => (
            <article
              key={cm.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {cm.label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 font-mono truncate">
                    {cm.id}
                  </p>
                </div>
                <Chip tone="info">{TYPE_LABEL[cm.type]}</Chip>
              </div>

              {(cm.value || cm.url) && (
                <p className="text-xs text-slate-600 break-all font-mono">
                  {cm.value ?? cm.url}
                </p>
              )}

              <div className="mt-1 flex flex-wrap gap-1">
                {cm.available_for.map((ct) => (
                  <Chip key={ct} tone="neutral">
                    {CASE_LABEL[ct] ?? ct}
                  </Chip>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

