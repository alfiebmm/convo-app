import { APP_CONFIG } from "@/config/app";

export default function WidgetPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Widget</h1>
      <p className="mt-1 text-sm text-slate-500">
        Configure and install your {APP_CONFIG.name} chatbot widget.
      </p>

      {/* Install snippet */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">
          Installation
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Add this snippet before the closing{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            &lt;/body&gt;
          </code>{" "}
          tag on your website.
        </p>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-900 p-4">
          <pre className="text-sm text-green-400 overflow-x-auto">
            {`<script
  src="${APP_CONFIG.url}/widget.js"
  data-tenant="YOUR_TENANT_ID"
  async
></script>`}
          </pre>
        </div>
      </div>

      {/* Content Hub */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">
          Content Hub
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Your published Q&amp;A content is publicly browsable at your hosted hub.
        </p>
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6">
          <label className="block text-sm font-medium text-slate-700">
            Your content hub
          </label>
          <div className="mt-2 flex items-center gap-3">
            <code className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {APP_CONFIG.url}/YOUR_TENANT_SLUG
            </code>
            <a
              href={`${APP_CONFIG.url}/YOUR_TENANT_SLUG`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            >
              View Hub →
            </a>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Replace YOUR_TENANT_SLUG with your actual tenant slug. Content published without an external CMS will appear here automatically.
          </p>
        </div>
      </div>

      {/* Widget Config */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">
          Configuration
        </h2>
        <div className="mt-4 space-y-6 rounded-lg border border-slate-200 bg-white p-6">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Chatbot Name
            </label>
            <input
              type="text"
              defaultValue={APP_CONFIG.name}
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Welcome Message
            </label>
            <input
              type="text"
              defaultValue="Hi! How can I help you today?"
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Persona / System Prompt
            </label>
            <textarea
              rows={4}
              defaultValue="You are a helpful assistant for this website. Answer questions based on the site content. Be friendly and concise."
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Primary Colour
            </label>
            <input
              type="color"
              defaultValue={APP_CONFIG.branding.secondary}
              className="mt-1 h-10 w-16 rounded border border-slate-200"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" className="rounded" />
              Auto-publish content (confidence threshold: 0.8+)
            </label>
          </div>
          <button className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors">
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
