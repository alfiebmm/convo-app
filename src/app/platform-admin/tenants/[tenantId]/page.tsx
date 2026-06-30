import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withAuditLog } from "@/lib/platform-admin/audit";
import {
  loadTenantDetail,
  parseTenantTab,
  tenantTabs,
  type TenantDetail,
  type TenantTab,
} from "@/lib/platform-admin/tenants-query";
import { startImpersonationAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const tabLabels: Record<TenantTab, string> = {
  profile: "Profile",
  usage: "Usage",
  activity: "Activity",
  notes: "Support notes",
  danger: "Danger zone",
};

// Truncate the settings preview so a misbehaving tenant payload can't blow
// out the page. Anything past this lives behind the "raw JSON" download
// (future ticket).
const SETTINGS_PREVIEW_MAX_CHARS = 8000;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

function statusClass(status: string) {
  if (status === "active") return "bg-green-100 text-green-800";
  if (status === "suspended") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function label(value: string) {
  return value.replace("_", " ");
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(
        status,
      )}`}
    >
      {label(status)}
    </span>
  );
}

function Tabs({
  tenantId,
  active,
}: {
  tenantId: string;
  active: TenantTab;
}) {
  return (
    <nav
      className="flex flex-wrap gap-2 border-b border-zinc-200"
      aria-label="Tenant detail sections"
    >
      {tenantTabs.map((tab) => (
        <Link
          key={tab}
          href={`/platform-admin/tenants/${tenantId}?tab=${tab}`}
          aria-current={active === tab ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
            active === tab
              ? "border-[#FF6B2C] text-zinc-950"
              : "border-transparent text-zinc-500 hover:text-zinc-900"
          }`}
        >
          {tabLabels[tab]}
        </Link>
      ))}
    </nav>
  );
}

function ProfileTab({ detail }: { detail: TenantDetail }) {
  const { tenant, owner, members } = detail;
  const settingsJson = JSON.stringify(tenant.settings ?? {}, null, 2);
  const settingsTooLarge = settingsJson.length > SETTINGS_PREVIEW_MAX_CHARS;
  const settingsPreview = settingsTooLarge
    ? `${settingsJson.slice(0, SETTINGS_PREVIEW_MAX_CHARS)}\n\n... [truncated — ${settingsJson.length - SETTINGS_PREVIEW_MAX_CHARS} more characters]`
    : settingsJson;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="space-y-6">
        <div className="grid gap-4 rounded-md border border-zinc-200 bg-white p-5 text-sm md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase text-zinc-500">Name</div>
            <div className="mt-1 font-semibold">{tenant.name}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-zinc-500">Slug</div>
            <div className="mt-1 font-mono text-xs">{tenant.slug}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-zinc-500">Domain</div>
            <div className="mt-1">{tenant.domain ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-zinc-500">Plan</div>
            <div className="mt-1 inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold capitalize text-zinc-800">
              {tenant.plan}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-zinc-500">Signup date</div>
            <div className="mt-1">{formatDate(tenant.createdAt)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-zinc-500">Owner</div>
            <div className="mt-1">
              {owner ? (
                // CON-PLATFORM-ADMIN-QA-1: /platform-admin/users/[userId] does
                // not exist yet (ships in ADMIN-6 user-detail ticket). Render
                // a mailto: instead so the link is useful rather than a 404.
                <a
                  href={`mailto:${owner.email}`}
                  className="text-[#E85A1E] underline-offset-2 hover:underline"
                >
                  {owner.email}
                </a>
              ) : (
                "—"
              )}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-zinc-500">Stripe customer</div>
            <div className="mt-1 font-mono text-xs">{tenant.stripeCustomerId ?? "—"}</div>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Stripe deep-link wires in CON-222"
              className="mt-2 inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-400"
            >
              Open in Stripe
              <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] uppercase tracking-normal text-zinc-600">
                Soon
              </span>
            </button>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-zinc-500">Status</div>
            <div className="mt-1 flex items-center gap-3">
              <StatusPill status={tenant.status} />
              <Link
                href={`/platform-admin/tenants/${tenant.id}?tab=danger`}
                className="text-xs font-semibold text-[#E85A1E] underline-offset-2 hover:underline"
              >
                See Danger zone
              </Link>
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs font-semibold uppercase text-zinc-500">
              Impersonate
            </div>
            <p className="mt-1 text-sm text-zinc-600">
              View the tenant dashboard as staff. Logged to the admin audit
              trail. Session expires after 60 minutes.
            </p>
            <form
              action={async () => {
                "use server";
                await startImpersonationAction(tenant.id);
              }}
              className="mt-2"
            >
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-[#FF6B2C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E85A1E]"
              >
                Impersonate this tenant
              </button>
            </form>
          </div>
        </div>

        <section className="overflow-hidden rounded-md border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
            <h2 className="font-semibold">Team members</h2>
          </div>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Team members for this tenant.</caption>
            <thead className="bg-zinc-100 text-xs uppercase text-zinc-600">
              <tr>
                <th scope="col" className="px-4 py-3">Email</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3">
                    <a
                      href={`mailto:${member.email}`}
                      className="text-zinc-900 underline-offset-2 hover:underline"
                    >
                      {member.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 capitalize">{member.role}</td>
                  <td className="px-4 py-3 text-zinc-600">{formatDate(member.createdAt)}</td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-zinc-500">
                    No team members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Settings JSON</h2>
          {settingsTooLarge && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-normal text-amber-800">
              Truncated
            </span>
          )}
        </div>
        <pre className="mt-3 max-h-[40rem] overflow-auto rounded-md bg-zinc-950 p-4 text-xs text-zinc-100">
          {settingsPreview}
        </pre>
      </section>
    </div>
  );
}

function ActivityTab({ detail }: { detail: TenantDetail }) {
  const hasPlanEvents = detail.timeline.some((item) => item.kind === "plan");
  return (
    <section className="rounded-md border border-zinc-200 bg-white">
      {!hasPlanEvents && (
        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          Plan change history will populate as changes happen via CON-222.
        </div>
      )}
      <ol className="divide-y divide-zinc-200">
        {detail.timeline.map((item) => (
          <li key={`${item.kind}-${item.id}`} className="px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase text-zinc-500">
                  {label(item.kind)}
                </div>
                <div className="mt-1 font-semibold">
                  {item.href ? (
                    <Link href={item.href} className="underline-offset-2 hover:underline">
                      {item.title}
                    </Link>
                  ) : (
                    item.title
                  )}
                </div>
                {item.detail && <div className="mt-1 text-sm text-zinc-600">{item.detail}</div>}
              </div>
              <time className="shrink-0 text-xs text-zinc-500" dateTime={item.at}>
                {relativeTime(item.at)}
              </time>
            </div>
          </li>
        ))}
        {detail.timeline.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-zinc-500">
            No recent activity found.
          </li>
        )}
      </ol>
    </section>
  );
}

function DangerTab({ detail }: { detail: TenantDetail }) {
  const { tenant } = detail;
  return (
    <div className="space-y-4">
      <section className="rounded-md border border-amber-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Suspend tenant</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Blocks tenant access and widget chat once wired.
            </p>
          </div>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Wires in CON-225 (ADMIN-8)"
            className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-400"
          >
            Suspend tenant
            <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] uppercase tracking-normal text-zinc-600">
              Soon
            </span>
          </button>
        </div>
        {tenant.status === "suspended" && (
          <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            Suspended {formatDate(tenant.suspendedAt)} by {tenant.suspendedByEmail ?? "unknown"}.
            <div className="mt-1">{tenant.suspendedReason ?? "No reason recorded."}</div>
          </div>
        )}
      </section>

      {tenant.status === "suspended" && (
        <section className="rounded-md border border-green-200 bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Reactivate tenant</h2>
              <p className="mt-1 text-sm text-zinc-600">Restores a suspended tenant once wired.</p>
            </div>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Wires in CON-225 (ADMIN-8)"
              className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-400"
            >
              Reactivate tenant
              <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] uppercase tracking-normal text-zinc-600">
                Soon
              </span>
            </button>
          </div>
        </section>
      )}

      <section className="rounded-md border border-red-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Soft-delete tenant</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Marks the tenant for deletion without hard-deleting rows.
            </p>
          </div>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Wires in CON-225"
            className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-400"
          >
            Soft-delete tenant
            <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] uppercase tracking-normal text-zinc-600">
              Soon
            </span>
          </button>
        </div>
        {tenant.status === "deleted_soft" && (
          <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-900">
            Soft-deleted {formatDate(tenant.softDeletedAt)} by{" "}
            {tenant.softDeletedByEmail ?? "unknown"}.
            <div className="mt-1">{tenant.softDeletedReason ?? "No reason recorded."}</div>
          </div>
        )}
      </section>
    </div>
  );
}

function TabContent({ tab, detail }: { tab: TenantTab; detail: TenantDetail }) {
  if (tab === "usage") {
    return (
      <section className="rounded-md border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
        Usage metrics shipping in ADMIN-5 (CON-223).
      </section>
    );
  }
  if (tab === "activity") return <ActivityTab detail={detail} />;
  if (tab === "notes") {
    return (
      <section className="rounded-md border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
        Support notes shipping in ADMIN-5 (CON-223).
      </section>
    );
  }
  if (tab === "danger") return <DangerTab detail={detail} />;
  return <ProfileTab detail={detail} />;
}

async function TenantDetailBody({
  tenantId,
  tab,
}: {
  tenantId: string;
  tab: TenantTab;
}) {
  const result = await withAuditLog({
    action: "tenant.view",
    target: { type: "tenant", id: tenantId },
    metadata: { tab },
    fn: async () => loadTenantDetail(tenantId),
  });

  if (!result.ok) notFound();
  const detail = result.value;

  return (
    <>
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/platform-admin/tenants"
              className="text-sm font-semibold text-zinc-500 underline-offset-2 hover:underline"
            >
              ← Tenants
            </Link>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-normal">
              {detail.tenant.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
              <span className="font-mono text-xs">{detail.tenant.id}</span>
              <StatusPill status={detail.tenant.status} />
            </div>
          </div>
        </div>
      </div>

      <Tabs tenantId={detail.tenant.id} active={tab} />
      <TabContent tab={tab} detail={detail} />
    </>
  );
}

function DetailSkeleton() {
  return (
    <div
      className="space-y-6 animate-pulse"
      aria-busy="true"
      aria-live="polite"
    >
      <div>
        <div className="h-3 w-20 rounded bg-zinc-200" />
        <div className="mt-3 h-7 w-64 rounded bg-zinc-200" />
        <div className="mt-2 h-3 w-48 rounded bg-zinc-200" />
      </div>
      <div className="flex gap-3 border-b border-zinc-200 pb-2">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="h-4 w-20 rounded bg-zinc-200" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-4 rounded-md border border-zinc-200 bg-white p-5 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="space-y-2">
              <div className="h-3 w-24 rounded bg-zinc-200" />
              <div className="h-4 w-40 rounded bg-zinc-200" />
            </div>
          ))}
        </div>
        <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-5">
          <div className="h-3 w-32 rounded bg-zinc-200" />
          <div className="h-40 w-full rounded bg-zinc-200" />
        </div>
      </div>
      <span className="sr-only">Loading tenant…</span>
    </div>
  );
}

export default async function PlatformAdminTenantDetailPage({
  params,
  searchParams,
}: PageProps) {
  const [{ tenantId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const tab = parseTenantTab(resolvedSearchParams);

  return (
    <div className="space-y-6">
      <Suspense key={`${tenantId}:${tab}`} fallback={<DetailSkeleton />}>
        <TenantDetailBody tenantId={tenantId} tab={tab} />
      </Suspense>
    </div>
  );
}
