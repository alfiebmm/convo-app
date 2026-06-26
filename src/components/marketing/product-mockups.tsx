import type { ReactNode } from "react";

/**
 * Hero chat-to-pipeline visualisation. Shows a live chat on the left
 * and the resulting content queue on the right. The example uses a
 * dental conversation by default because dental is the GTM wedge,
 * but the component is generic and consumers can pass children.
 */
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
              <h3 className="mt-1 text-lg font-bold text-white">
                After-hours visitor
              </h3>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              High intent
            </span>
          </div>
          <div className="space-y-3">
            <Bubble side="left">
              I broke a molar this morning. Do you do same-day crowns? I work
              in the city so somewhere near North Sydney would be ideal.
            </Bubble>
            <Bubble side="right">
              Yes. We do same-day CEREC crowns at our North Sydney rooms.
              We have one slot at 4.20pm today and three on Wednesday. Would
              you like me to hold one and text you a confirmation?
            </Bubble>
            <Bubble side="left">
              4.20 today would be perfect.
            </Bubble>
          </div>
          <div className="mt-4 rounded-lg border border-orange-400/30 bg-orange-400/10 p-3">
            <p className="text-xs font-semibold text-orange-200">
              Lead captured · same-day crown · North Sydney
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              Routed to reception. Conversation context attached.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-white p-4 text-zinc-950">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Content queue
              </p>
              <h3 className="mt-1 text-lg font-bold">From this week&rsquo;s chats</h3>
            </div>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
              Review
            </span>
          </div>
          <div className="mt-4 space-y-3">
            <PipelineItem
              label="Create"
              title="Same-day crowns in North Sydney: what to expect"
              note="Drawn from 14 conversations asking about emergency dental, CEREC, and same-day options."
            />
            <PipelineItem
              label="Update"
              title="Crown vs onlay: which is right for a cracked molar"
              note="Existing page now ranks page 2. Convo suggests three additions to lift it."
            />
            <PipelineItem
              label="Measure"
              title="Emergency dental enquiries"
              note="Track clicks, chat starts, booked appointments. Compare to last quarter."
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
  children: ReactNode;
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

/**
 * Full five-step workflow used on /how-it-works.
 */
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

/**
 * Three-step variant for the home page. Bigger cards, more breathing
 * room, arrow connectors on desktop.
 */
export function HomeWorkflow({
  steps,
}: {
  steps: ReadonlyArray<{ number: string; title: string; description: string }>;
}) {
  return (
    <div className="relative grid gap-5 md:grid-cols-3">
      {steps.map((step, i) => (
        <div
          key={step.number}
          className="relative rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-baseline gap-3">
            <span className="font-display text-3xl font-extrabold text-[var(--convo-orange)]">
              {step.number}
            </span>
            <h3 className="font-display text-xl font-bold text-zinc-950">
              {step.title}
            </h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            {step.description}
          </p>
          {i < steps.length - 1 ? (
            <div
              aria-hidden
              className="absolute right-[-14px] top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-xs font-bold text-zinc-500 shadow-sm md:flex"
            >
              →
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Compounding-loop visualisation. Four nodes wrapping into a flywheel.
 * This is the moat made visible: the more conversations a tenant runs,
 * the more first-party data they accumulate that nobody else has.
 */
export function CompoundingLoop() {
  const nodes: Array<{ label: string; sub: string; icon: string }> = [
    { label: "Visitors", sub: "land on your site", icon: "👥" },
    { label: "Conversations", sub: "with Convo", icon: "💬" },
    { label: "Content", sub: "that answers them", icon: "📝" },
    { label: "SEO traffic", sub: "back to your site", icon: "🔍" },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,107,44,0.18), transparent 60%)",
        }}
      />
      <div className="relative grid items-center gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
        {nodes.map((node, i) => (
          <div key={node.label} className="contents">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-center">
              <div className="text-3xl" aria-hidden>
                {node.icon}
              </div>
              <p className="font-display text-lg font-bold text-white">
                {node.label}
              </p>
              <p className="text-xs text-zinc-400">{node.sub}</p>
            </div>
            {i < nodes.length - 1 ? (
              <div
                aria-hidden
                className="flex items-center justify-center text-2xl text-[var(--convo-orange)] md:block"
              >
                →
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="relative mt-6 flex items-center justify-center gap-2 text-sm text-zinc-400">
        <span className="text-[var(--convo-orange)]">↻</span>
        <span>And the loop runs again. Every cycle, the dataset gets richer.</span>
      </div>
    </div>
  );
}

/**
 * Dashboard mockup. Faux browser chrome, side nav, content pipeline.
 * Shows the product is real and you can see what the dashboard looks
 * like before you sign up.
 */
export function DashboardMockup() {
  const rows: Array<{
    title: string;
    note: string;
    status: "Published" | "Generating" | "Draft" | "Ranked";
  }> = [
    {
      title: "Same-day crowns in North Sydney: what to expect",
      note: "Generated from 14 conversations · Published 2 hours ago",
      status: "Published",
    },
    {
      title: "How much does Invisalign cost in 2026?",
      note: "Extracted from 22 conversations · Writing in progress",
      status: "Generating",
    },
    {
      title: "Emergency dental: what counts and what doesn't",
      note: "Extracted from 18 conversations · Ready for review",
      status: "Draft",
    },
    {
      title: "Crown vs onlay: which is right for a cracked molar",
      note: "Updated last week · Now ranking position 4 for primary keyword",
      status: "Ranked",
    },
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-950/5">
      <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-zinc-300" />
        <span className="h-3 w-3 rounded-full bg-zinc-300" />
        <span className="h-3 w-3 rounded-full bg-zinc-300" />
        <span className="ml-3 rounded-md bg-white px-3 py-1 text-xs text-zinc-500 shadow-sm">
          app.convoapp.com.au/dashboard
        </span>
      </div>
      <div className="grid gap-0 md:grid-cols-[200px_1fr]">
        <nav className="border-r border-zinc-200 bg-zinc-50 p-3 text-sm">
          {[
            ["Content pipeline", true],
            ["Conversations", false],
            ["Analytics", false],
            ["Integrations", false],
            ["Settings", false],
          ].map(([label, active]) => (
            <div
              key={String(label)}
              className={`mb-1 rounded-md px-3 py-2 font-medium ${
                active
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-500"
              }`}
            >
              {label as string}
            </div>
          ))}
        </nav>
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
              Content pipeline · 14 articles this week
            </p>
            <span className="text-xs text-zinc-500">Last 7 days</span>
          </div>
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.title}
                className="rounded-lg border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">
                      {row.title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{row.note}</p>
                  </div>
                  <StatusPill status={row.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: "Published" | "Generating" | "Draft" | "Ranked";
}) {
  const tone =
    status === "Published"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "Generating"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : status === "Draft"
          ? "bg-zinc-100 text-zinc-700 border-zinc-200"
          : "bg-orange-50 text-orange-700 border-orange-200";
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {status}
    </span>
  );
}
