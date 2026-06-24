import { requirePlatformStaff } from "@/lib/platform-admin/access";

export const dynamic = "force-dynamic";

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
        Surfaces coming soon.
      </p>
      <div className="mt-8 h-24 border-l-4 border-[#FF6B2C] bg-white shadow-sm" />
    </section>
  );
}
