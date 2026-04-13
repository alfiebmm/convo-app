import { APP_CONFIG } from "@/config/app";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          {APP_CONFIG.name}
        </h1>
        <p className="mt-2 text-lg text-slate-500">{APP_CONFIG.tagline}</p>
        <div className="mt-8 flex gap-4 justify-center">
          <a
            href="/dashboard"
            className="rounded-lg bg-blue-500 px-6 py-3 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
