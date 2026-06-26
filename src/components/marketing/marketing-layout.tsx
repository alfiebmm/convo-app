import Link from "next/link";
import type { ReactNode } from "react";
import { APP_CONFIG } from "@/config/app";
import { featureCards } from "@/lib/marketing/content";

const navItems = [
  { href: "/features", label: "Product" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/resources/examples", label: "Examples" },
  { href: "/faq", label: "FAQ" },
];

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            className="font-logo text-3xl font-bold leading-none text-[var(--convo-orange)]"
          >
            {APP_CONFIG.name.toLowerCase()}
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {navItems.map((item) => (
              item.href === "/features" ? (
                <div key={item.href} className="group relative">
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-1.5 py-5 text-sm font-medium text-zinc-600 transition hover:text-zinc-950"
                  >
                    {item.label}
                    <span className="text-xs text-zinc-400 transition group-hover:text-zinc-700">
                      ▾
                    </span>
                  </Link>
                  <div className="invisible absolute left-0 top-full w-[560px] translate-y-2 rounded-xl border border-zinc-200 bg-white p-3 opacity-0 shadow-xl shadow-zinc-950/10 transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                    <Link
                      href="/features"
                      className="block rounded-lg bg-zinc-50 p-4 transition hover:bg-orange-50"
                    >
                      <p className="text-sm font-bold text-zinc-950">
                        Product overview
                      </p>
                      <p className="mt-1 text-sm leading-5 text-zinc-600">
                        The full Convo loop: chat, capture, content,
                        publishing, and measurement.
                      </p>
                    </Link>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {featureCards.map((feature) => (
                        <Link
                          key={feature.href}
                          href={feature.href}
                          className="rounded-lg p-3 transition hover:bg-zinc-50"
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
                            {feature.eyebrow}
                          </p>
                          <p className="mt-1 text-sm font-bold text-zinc-950">
                            {feature.title}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                            {feature.description}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium text-zinc-600 transition hover:text-zinc-950"
                >
                  {item.label}
                </Link>
              )
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-semibold text-zinc-600 transition hover:text-zinc-950 sm:inline"
            >
              Login
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-[var(--convo-orange)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--convo-orange-hover)]"
            >
              Start free
            </Link>
          </div>
        </div>
        <nav className="border-t border-zinc-200/70 px-5 py-2 md:hidden">
          <div className="flex gap-5 overflow-x-auto whitespace-nowrap text-sm font-medium text-zinc-600">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 transition hover:text-zinc-950"
              >
                {item.label}
              </Link>
            ))}
            {featureCards.map((feature) => (
              <Link
                key={feature.href}
                href={feature.href}
                className="shrink-0 transition hover:text-zinc-950"
              >
                {feature.title}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      {children}
      <footer className="border-t border-zinc-200 bg-zinc-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.2fr_2fr]">
          <div>
            <div className="font-logo text-3xl font-bold text-[var(--convo-orange)]">
              {APP_CONFIG.name.toLowerCase()}
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-zinc-400">
              The AI growth layer for service-business websites. Chat captures
              leads now. The content engine captures rankings later. Both
              compound.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            <FooterColumn
              title="Product"
              links={[
                ["/features", "Product overview"],
                ["/features/ai-chatbot", "AI Chatbot"],
                ["/features/lead-capture", "Lead Capture"],
                ["/features/seo-content-pipeline", "SEO Content Pipeline"],
                ["/features/analytics", "SEO Performance Analytics"],
                ["/features/content-maintenance", "Content Maintenance"],
                ["/features/knowledge-base", "Knowledge Base"],
                ["/features/cms-publishing", "CMS Publishing"],
                ["/how-it-works", "How it works"],
                ["/integrations", "Integrations"],
                ["/pricing", "Pricing"],
              ]}
            />
            <FooterColumn
              title="Resources"
              links={[
                ["/resources/examples", "Examples"],
                ["/faq", "FAQ"],
                ["/compare/searchatlas", "Compare SearchAtlas"],
                ["/compare/opinly", "Compare Opinly"],
              ]}
            />
            <FooterColumn
              title="Company"
              links={[
                ["/use-cases", "Use cases"],
                ["/contact", "Contact"],
                ["/login", "Login"],
                ["/privacy", "Privacy"],
                ["/terms", "Terms"],
              ]}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<[string, string]>;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <div className="mt-4 grid gap-3">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="text-sm text-zinc-400 transition hover:text-white"
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Section({
  eyebrow,
  title,
  description,
  children,
  tone = "light",
  headingLevel = "h2",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  tone?: "light" | "dark" | "soft";
  headingLevel?: "h1" | "h2";
}) {
  const toneClass =
    tone === "dark"
      ? "bg-zinc-950 text-white"
      : tone === "soft"
        ? "bg-zinc-50 text-zinc-950"
        : "bg-white text-zinc-950";

  return (
    <section className={toneClass}>
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
              {eyebrow}
            </p>
          ) : null}
          {headingLevel === "h1" ? (
            <h1 className="font-display text-4xl font-extrabold leading-tight tracking-normal sm:text-5xl">
              {title}
            </h1>
          ) : (
            <h2 className="font-display text-4xl font-extrabold leading-tight tracking-normal sm:text-5xl">
              {title}
            </h2>
          )}
          {description ? (
            <p
              className={`mt-5 text-lg leading-8 ${
                tone === "dark" ? "text-zinc-300" : "text-zinc-600"
              }`}
            >
              {description}
            </p>
          ) : null}
        </div>
        {children ? <div className="mt-12">{children}</div> : null}
      </div>
    </section>
  );
}

export function CTASection() {
  return (
    <section className="bg-zinc-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-16 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-3xl font-extrabold">
            Try Convo on your own website.
          </h2>
          <p className="mt-3 max-w-2xl text-zinc-400">
            Install the widget, watch real visitor questions land, and review
            every lead and content suggestion before anything ships. Live in
            15 minutes on WordPress, Shopify, or Webflow.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-[var(--convo-orange)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--convo-orange-hover)]"
          >
            Start free
          </Link>
          <Link
            href="/how-it-works"
            className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
          >
            See how it works
          </Link>
        </div>
      </div>
    </section>
  );
}
