export default function ConversationsPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conversations</h1>
          <p className="mt-1 text-sm text-slate-500">
            All chatbot conversations from your site visitors.
          </p>
        </div>
        <div className="flex gap-2">
          <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <option>All statuses</option>
            <option>Active</option>
            <option>Completed</option>
            <option>Archived</option>
          </select>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white">
        <div className="p-12 text-center text-sm text-slate-400">
          No conversations yet. Conversations will appear here once visitors
          start chatting with your widget.
        </div>
      </div>
    </div>
  );
}
