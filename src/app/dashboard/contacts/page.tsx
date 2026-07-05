import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth-context";
import {
  listContactsByTenant,
  type ContactListSort,
  type ListContactsByTenantFilters,
} from "@/lib/contacts";
import ContactsList from "./contacts-list";
import { ContactsFilters } from "./contacts-filters";
import { parseContactFilters, type ContactFilterState } from "./filter-state";
import { withDashboardErrorLogging } from "@/lib/errors/wrap";

function parseDateParam(value: string | undefined, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(
    endOfDay ? `${value}T23:59:59.999` : `${value}T00:00:00`,
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parsePage(value: string | undefined) {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  return Math.max(1, Number(value));
}

function toContactListFilters(
  filters: ContactFilterState,
): ListContactsByTenantFilters {
  return {
    q: filters.q,
    persona: filters.persona,
    caseType: filters["case-type"],
    caseStatus: filters["case-status"],
    from: parseDateParam(filters.from),
    to: parseDateParam(filters.to, true),
    page: parsePage(filters.page),
    sort: filters.sort ?? "last-seen-desc",
  };
}

async function ContactsPageImpl({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const params = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      if (value[0]) urlParams.set(key, value[0]);
    } else if (value) {
      urlParams.set(key, value);
    }
  }

  const activeFilters = parseContactFilters(urlParams);
  const listFilters = toContactListFilters(activeFilters);
  const contactsData = await listContactsByTenant(tenant.id, listFilters);
  const page = listFilters.page ?? 1;
  const sort = (listFilters.sort ?? "last-seen-desc") as ContactListSort;

  return (
    <div>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
          <p className="mt-1 text-sm text-slate-500">
            People and companies captured from chatbot conversations.
          </p>
        </div>
        <Suspense>
          <ContactsFilters />
        </Suspense>
      </div>

      {contactsData.totalCount === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white">
          <div className="p-12 text-center text-sm text-slate-400">
            No contacts found. Contacts will appear here once visitors share
            details through your widget.
          </div>
        </div>
      ) : (
        <ContactsList
          contacts={contactsData.rows}
          totalCount={contactsData.totalCount}
          page={page}
          sort={sort}
        />
      )}
    </div>
  );
}

// CON-error-logging: capture any throw from the contacts list render path.
export default withDashboardErrorLogging(ContactsPageImpl, {
  route: "/dashboard/contacts",
});
