export function ChatPipelineMockup() {
  return (
    <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl shadow-orange-950/20">
      <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
                Live chat
              </p>
              <h2 className="mt-1 text-lg font-bold text-white">
                Doggo visitor
              </h2>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              High intent
            </span>
          </div>
          <div className="space-y-3">
            <Bubble side="left">
              I&apos;m looking for a Cavoodle puppy near Brisbane. Are there any
              breeders with litters available soon?
            </Bubble>
            <Bubble side="right">
              Yes. I can show you Cavoodle breeders near Brisbane and help
              compare waitlists, pricing, health checks, and transport options.
            </Bubble>
            <Bubble side="left">
              Great. Can you send me the best matches and a guide on what to ask
              the breeder?
            </Bubble>
          </div>
          <div className="mt-4 rounded-lg border border-orange-400/30 bg-orange-400/10 p-3">
            <p className="text-xs font-semibold text-orange-200">
              Lead capture triggered by breed, location, and availability intent
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              Custom CTA: Send me Cavoodle breeder matches
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-white p-4 text-zinc-950">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Recommendations
              </p>
              <h2 className="mt-1 text-lg font-bold">Content queue</h2>
            </div>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
              Review
            </span>
          </div>
          <div className="mt-4 space-y-3">
            <PipelineItem
              label="Create"
              title="Best Cavoodle breeders near Brisbane"
              note="Built from repeated breed, location, price, and waitlist questions"
            />
            <PipelineItem
              label="Update"
              title="Cavoodle questions to ask a breeder"
              note="Existing guide can answer health checks, deposits, transport, and timing"
            />
            <PipelineItem
              label="Measure"
              title="Puppy enquiry performance"
              note="Track search clicks, chat starts, matched breeders, and captured leads"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  side,
  children,
}: {
  side: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-6 ${
        side === "left"
          ? "bg-zinc-800 text-zinc-100"
          : "ml-auto bg-[var(--convo-orange)] text-white"
      }`}
    >
      {children}
    </div>
  );
}

function PipelineItem({
  label,
  title,
  note,
}: {
  label: string;
  title: string;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-950">{title}</p>
        <span className="rounded bg-white px-2 py-1 text-xs font-semibold text-[var(--convo-orange)] shadow-sm">
          {label}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-500">{note}</p>
    </div>
  );
}

export function WorkflowDiagram() {
  const items = [
    ["1", "Visitor asks", "Questions, objections, and buying intent arrive in chat."],
    ["2", "Convo responds", "Answers use the business knowledge base and guardrails."],
    ["3", "Lead is captured", "Subtle CTA rules decide when and how to ask."],
    ["4", "Content is triaged", "Create, update, merge, or skip based on existing content and SEO data."],
    ["5", "Results are tracked", "Approved changes are measured against clicks, rankings, conversations, and leads."],
  ];

  return (
    <div className="grid gap-3 md:grid-cols-5">
      {items.map(([number, title, description]) => (
        <div
          key={number}
          className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-sm font-bold text-[var(--convo-orange)]">
            {number}
          </div>
          <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
        </div>
      ))}
    </div>
  );
}
