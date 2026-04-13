"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { APP_CONFIG } from "@/config/app";

const steps = ["Create your site", "Configure chatbot", "Install widget", "Choose plan"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

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

  function handleSkipToComplete() {
    router.push("/dashboard");
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
                onClick={() => setStep(3)}
                className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Choose your plan
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Start free and upgrade when you&apos;re ready.
              </p>
              <div className="mt-6 space-y-3">
                <PlanCard
                  name="Starter"
                  price="Free"
                  features={[
                    `${APP_CONFIG.limits.starter.conversationsPerMonth} conversations/mo`,
                    `${APP_CONFIG.limits.starter.articlesPerMonth} articles/mo`,
                  ]}
                  active
                />
                <PlanCard
                  name="Growth"
                  price="$49/mo"
                  features={[
                    `${APP_CONFIG.limits.growth.conversationsPerMonth.toLocaleString()} conversations/mo`,
                    `${APP_CONFIG.limits.growth.articlesPerMonth} articles/mo`,
                  ]}
                />
                <PlanCard
                  name="Pro"
                  price="$149/mo"
                  features={[
                    `${APP_CONFIG.limits.pro.conversationsPerMonth.toLocaleString()} conversations/mo`,
                    `${APP_CONFIG.limits.pro.articlesPerMonth} articles/mo`,
                  ]}
                />
              </div>
              <button
                onClick={handleSkipToComplete}
                className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
              >
                Start with Starter (Free)
              </button>
              <p className="mt-3 text-center text-xs text-slate-400">
                You can upgrade anytime from Settings → Billing.
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
  features,
  active,
}: {
  name: string;
  price: string;
  features: string[];
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        active
          ? "border-slate-900 bg-slate-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-slate-900">{name}</p>
          <p className="text-sm text-slate-500">{price}</p>
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
    </div>
  );
}
