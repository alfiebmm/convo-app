import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth-context";
import { getContactById } from "@/lib/contacts";

export default async function ContactDetailStubPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const { contactId } = await params;
  const contact = await getContactById(tenant.id, contactId);
  if (!contact) notFound();

  return (
    <div>
      <div>
        <Link
          href="/dashboard/contacts"
          className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          Back to contacts
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">
          {contact.displayName ?? "No name"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Contact detail view ships in CON-176.
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-400">Email</dt>
            <dd className="mt-1 text-slate-700">
              {contact.emailNormalised ?? "None"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Phone</dt>
            <dd className="mt-1 text-slate-700">
              {contact.phoneNormalised ?? "None"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Preferred contact method</dt>
            <dd className="mt-1 text-slate-700">
              {contact.preferredContactMethod ?? "None"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Last seen</dt>
            <dd className="mt-1 text-slate-700">
              {new Date(contact.lastSeenAt).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
