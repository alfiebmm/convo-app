"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { APP_CONFIG } from "@/config/app";
import { homePricingTiers } from "@/lib/marketing/content";

const steps = ["Create your site", "Configure chatbot", "Install widget", "Choose plan"];
type BillingPlan = "starter" | "growth" | "scale";
type BillingInterval = "month" | "year";

function parsePlan(value: string | null): BillingPlan | null {
  if (value === "starter" || value === "growth" || value === "scale") {
    return value;
  }
  return null;
}

function parseInterval(value: string | null): BillingInterval {
  return value === "month" ? "month" : "year";
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="text-sm text-slate-500">Loading...</div>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const searchParams = useSearchParams();
  const signupPlan = parsePlan(searchParams.get("plan"));
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan>(
    signupPlan ?? "starter"
  );
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>(
    parseInterval(searchParams.get("interval"))
  );

  // Form state
  const [siteName, setSiteName] = useState("");
  const [domain, setDomain] = useState("");
  const [persona, setPersona] = useState(
    "You are a helpful assistant for this website. Answer questions based on the site content. Be friendly and concise."
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    "Hi! How can I help you today?"
  );

  async function handleCreateSite() {
    if (!siteName) return;
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/create-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: siteName, domain }),
      });
      const data = await res.json();
      if (data.tenantId) {
        setTenantId(data.tenantId);
        setStep(1);
      }
    } catch (err) {
      console.error("Failed to create site:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfigureChatbot() {
    if (!tenantId) return;
    setLoading(true);
    try {
      await fetch("/api/onboarding/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, persona, welcomeMessage }),
      });
      setStep(2);
    } catch (err) {
      console.error("Failed to configure:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartCheckout(
    plan: BillingPlan = selectedPlan,
    interval: BillingInterval = selectedInterval
  ) {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          plan,
          interval,
          trial_period_days: 14,
          returnPath: "/dashboard",
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      console.error("Checkout failed:", data.error);
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleInstallComplete() {
    if (signupPlan) {
      void handleStartCheckout(signupPlan, selectedInterval);
      return;
    }
    setStep(3);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome to {APP_CONFIG.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Let&apos;s get you set up in a few quick steps.
          </p>
        </div>

        {/* Steps indicator */}
        <div className="mt-8 flex items-center justify-center gap-2">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  i <= step
                    ? "bg-slate-900 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`h-0.5 w-8 ${
                    i < step ? "bg-slate-900" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {step === 0 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Create your site
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Tell us about the website you&apos;ll be adding the chatbot to.
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Site Name
                  </label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    placeholder="My Website"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Domain
                  </label>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="example.com"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Optional. You can add this later.
                  </p>
                </div>
              </div>
              <button
                onClick={handleCreateSite}
                disabled={loading || !siteName}
                className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {loading ? "Creating..." : "Continue"}
              </button>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Configure your chatbot
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Customise how your chatbot behaves and greets visitors.
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Welcome Message
                  </label>
                  <input
                    type="text"
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Persona / System Prompt
                  </label>
                  <textarea
                    rows={4}
                    value={persona}
                    onChange={(e) => setPersona(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={handleConfigureChatbot}
                disabled={loading}
                className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {loading ? "Saving..." : "Continue"}
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Install the widget
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Add this snippet before the closing{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                  &lt;/body&gt;
                </code>{" "}
                tag on your website.
              </p>
              <div className="mt-6 rounded-lg border border-slate-200 bg-slate-900 p-4">
                <pre className="text-sm text-green-400 overflow-x-auto whitespace-pre-wrap">
{`<script
  src="${APP_CONFIG.url}/widget.js"
  data-tenant="${tenantId}"
  async
></script>`}
                </pre>
              </div>
              <button
                onClick={handleInstallComplete}
                disabled={loading}
                className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {loading ? "Redirecting..." : "Continue"}
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Choose your plan
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Pick the tier that fits today. You can change it anytime.
              </p>
              <div className="mt-6 space-y-3">
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
                  {(["year", "month"] as const).map((interval) => (
                    <button
                      key={interval}
                      type="button"
                      onClick={() => setSelectedInterval(interval)}
                      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        selectedInterval === interval
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {interval === "year" ? "Annual" : "Monthly"}
                    </button>
                  ))}
                </div>
                {homePricingTiers.map((tier) => (
                  <PlanCard
                    key={tier.name}
                    name={tier.name}
                    price={
                      selectedInterval === "year"
                        ? `$${tier.annualMonthly}/mo, billed annually`
                        : `$${tier.monthly}/mo billed monthly`
                    }
                    monthly={
                      selectedInterval === "year"
                        ? `Or $${tier.monthly}/mo billed monthly`
                        : `$${tier.annualMonthly}/mo equivalent on annual billing`
                    }
                    features={tier.points.slice(0, 3) as readonly string[]}
                    featured={tier.featured}
                    active={selectedPlan === tier.name.toLowerCase()}
                    onSelect={() =>
                      setSelectedPlan(tier.name.toLowerCase() as BillingPlan)
                    }
                  />
                ))}
              </div>
              <button
                onClick={() => void handleStartCheckout()}
                disabled={loading}
                className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {loading
                  ? "Redirecting..."
                  : `Start ${selectedPlan} trial`}
              </button>
              <p className="mt-3 text-center text-xs text-slate-400">
                You can upgrade or change your plan anytime from Settings → Billing.
              </p>
            </div>
          )}
        </div>

        {step > 0 && step < 3 && (
          <button
            onClick={() => setStep(step - 1)}
            className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  monthly,
  features,
  active,
  featured,
  onSelect,
}: {
  name: string;
  price: string;
  monthly?: string;
  features: readonly string[];
  active?: boolean;
  featured?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-lg border p-4 ${
        active
          ? "border-slate-900 bg-slate-50"
          : featured
          ? "border-[var(--convo-orange)] bg-orange-50/40"
          : "border-slate-200 bg-white"
      } w-full text-left transition-colors hover:border-slate-400`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900">{name}</p>
            {featured && !active && (
              <span className="rounded-full bg-[var(--convo-orange)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                Recommended
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">{price}</p>
          {monthly && (
            <p className="text-xs text-slate-400">{monthly}</p>
          )}
        </div>
        {active && (
          <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-medium text-white">
            Current
          </span>
        )}
      </div>
      <ul className="mt-2 space-y-1">
        {features.map((f) => (
          <li key={f} className="text-xs text-slate-500">
            ✓ {f}
          </li>
        ))}
      </ul>
    </button>
  );
}
