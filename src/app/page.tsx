import Link from "next/link";
import { APP_CONFIG } from "@/config/app";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-xl font-bold text-slate-900">
            {APP_CONFIG.name}
          </Link>
          <nav className="flex items-center gap-4">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-32">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          {APP_CONFIG.tagline}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-500">
          {APP_CONFIG.description}
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            >
              Go to Dashboard →
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Login
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
