import Link from "next/link";
import { requirePlatformStaff } from "@/lib/platform-admin/access";

export const dynamic = "force-dynamic";

type Surface = {
  href: string;
  title: string;
  description: string;
  status: "live" | "soon";
};

const surfaces: Surface[] = [
  {
    href: "/platform-admin/tenants",
    title: "Tenants",
    description: "Search, filter, and drill into Convo tenant profiles.",
    status: "live",
  },
  {
    href: "/platform-admin/audit",
    title: "Audit log",
    description: "Intent and outcome rows for every platform-admin action.",
    status: "live",
  },
  {
    href: "/platform-admin/injection-events",
    title: "Injection events",
    description: "Prompt-injection-defence triggers across all tenants.",
    status: "soon",
  },
];

export default async function PlatformAdminHomePage() {
  const { user } = await requirePlatformStaff();
  const today = new Intl.DateTimeFormat("en-AU", {
    dateStyle: "full",
    timeZone: "Australia/Sydney",
  }).format(new Date());

  return (
    <section className="max-w-4xl">
      <p className="text-sm font-semibold uppercase tracking-normal text-[#E85A1E]">
        {today} &middot; {user.email}
      </p>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-normal text-zinc-950">
        Convo Platform Admin
      </h1>
      <p className="mt-3 max-w-2xl text-base text-zinc-600">
        Pick a surface to start. Every action on a tenant or audit row is
        logged with an intent + outcome pair for traceability.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {surfaces.map((surface) => (
          <SurfaceCard key={surface.href} surface={surface} />
        ))}
      </div>

      <div className="mt-10 rounded-md border border-zinc-200 bg-white p-5">
        <h2 className="font-display text-lg font-bold tracking-normal text-zinc-950">
          Operating notes
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-700">
          <li>
            <span className="font-semibold text-zinc-950">Read-only first.</span>{" "}
            Mutating actions (suspend, soft-delete, plan change) are gated
            behind the danger zone and require a written reason.
          </li>
          <li>
            <span className="font-semibold text-zinc-950">Audit by default.</span>{" "}
            Every page view and detail load writes a row to the admin audit
            log via{" "}
            <Link
              href="/platform-admin/audit"
              className="text-[#E85A1E] underline-offset-2 hover:underline"
            >
              the audit surface
            </Link>
            .
          </li>
          <li>
            <span className="font-semibold text-zinc-950">Don&apos;t share screenshots.</span>{" "}
            Tenant data is confidential. Use the audit log to share a
            specific row instead of a screen capture.
          </li>
        </ul>
      </div>
    </section>
  );
}

function SurfaceCard({ surface }: { surface: Surface }) {
  const isLive = surface.status === "live";
  const cardClasses = isLive
    ? "group block rounded-md border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-[#FF6B2C] hover:shadow-md"
    : "block rounded-md border border-zinc-200 bg-zinc-50 p-5 text-zinc-500";

  const titleClasses = isLive
    ? "font-display text-lg font-bold tracking-normal text-zinc-950 group-hover:text-[#E85A1E]"
    : "font-display text-lg font-bold tracking-normal text-zinc-700";

  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className={titleClasses}>{surface.title}</h3>
        {!isLive && (
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-normal text-zinc-700">
            Soon
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-zinc-600">{surface.description}</p>
    </>
  );

  if (isLive) {
    return (
      <Link href={surface.href} className={cardClasses}>
        {content}
      </Link>
    );
  }

  return <div className={cardClasses} aria-disabled="true">{content}</div>;
}
