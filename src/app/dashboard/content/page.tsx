export default function ContentPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Content</h1>
          <p className="mt-1 text-sm text-slate-500">
            AI-generated articles from your conversations. Review, edit, and
            publish.
          </p>
        </div>
        <div className="flex gap-2">
          <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <option>All statuses</option>
            <option>Pending</option>
            <option>In Review</option>
            <option>Approved</option>
            <option>Published</option>
            <option>Rejected</option>
          </select>
          <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <option>All types</option>
            <option>Blog</option>
            <option>FAQ</option>
            <option>Page Section</option>
          </select>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white">
        <div className="p-12 text-center text-sm text-slate-400">
          No content yet. As conversations come in, the pipeline will extract
          topics and generate articles for your review.
        </div>
      </div>
    </div>
  );
}
