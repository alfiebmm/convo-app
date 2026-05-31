"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
}

const TABS: Tab[] = [
  {
    href: "/dashboard/knowledge/documents",
    label: "Documents",
    match: (p) =>
      p === "/dashboard/knowledge" ||
      p.startsWith("/dashboard/knowledge/documents"),
  },
  {
    href: "/dashboard/knowledge/follow-up",
    label: "Follow-up",
    match: (p) => p.startsWith("/dashboard/knowledge/follow-up"),
  },
];

/**
 * Sub-tab strip for the Knowledge section.
 *
 * Client component (uses `usePathname`) so the layout can stay server-side.
 *
 * CON-158.
 */
export function KnowledgeTabs() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="-mb-px flex gap-6 overflow-x-auto"
      aria-label="Knowledge sections"
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              "border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors " +
              (active
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700")
            }
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
