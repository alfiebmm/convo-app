export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Manage your site, team, and integrations.
      </p>

      <div className="mt-8 space-y-8">
        {/* General */}
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">General</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Site Name
              </label>
              <input
                type="text"
                defaultValue="My Website"
                className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Domain
              </label>
              <input
                type="text"
                placeholder="example.com"
                className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        {/* CMS Integration */}
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            CMS Integration
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Connect to your CMS to publish content directly.
          </p>
          <div className="mt-4 space-y-3">
            <IntegrationCard
              name="WordPress"
              description="Publish articles via WP REST API"
              connected={false}
            />
            <IntegrationCard
              name="Shopify"
              description="Publish to Shopify blog"
              connected={false}
              comingSoon
            />
            <IntegrationCard
              name="Webflow"
              description="Publish to Webflow CMS"
              connected={false}
              comingSoon
            />
          </div>
        </section>

        {/* Team */}
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Team</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage who has access to this site.
          </p>
          <div className="mt-4 rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-400">
            Team management coming soon.
          </div>
        </section>

        {/* Billing */}
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Billing</h2>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 p-4">
            <div>
              <p className="font-medium text-slate-900">Starter Plan</p>
              <p className="text-sm text-slate-500">
                500 conversations / 10 articles per month
              </p>
            </div>
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors">
              Upgrade
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function IntegrationCard({
  name,
  description,
  connected,
  comingSoon,
}: {
  name: string;
  description: string;
  connected: boolean;
  comingSoon?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
      <div>
        <p className="font-medium text-slate-900">{name}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      {comingSoon ? (
        <span className="text-xs font-medium text-slate-400">Coming soon</span>
      ) : (
        <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          {connected ? "Connected" : "Connect"}
        </button>
      )}
    </div>
  );
}
