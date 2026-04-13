export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your chatbot performance and content pipeline at a glance.
      </p>

      {/* Stats Grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Conversations" value="0" subtitle="This month" />
        <StatCard label="Messages" value="0" subtitle="This month" />
        <StatCard label="Content Generated" value="0" subtitle="Articles in queue" />
        <StatCard label="Published" value="0" subtitle="Total articles live" />
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">
          Recent Conversations
        </h2>
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
          No conversations yet. Install the widget on your site to get started.
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Content Queue</h2>
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
          Content will appear here as conversations generate topics.
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}
