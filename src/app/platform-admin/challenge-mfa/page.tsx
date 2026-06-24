import { requirePlatformStaff } from "@/lib/platform-admin/access";
import { useRecoveryCodeAction, verifyTotpAndIssueSession } from "./actions";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function errorCopy(error?: string) {
  if (error === "code") return "That authenticator code did not verify.";
  if (error === "recovery") return "That recovery code did not verify.";
  return null;
}

export default async function ChallengeMfaPage({ searchParams }: PageProps) {
  await requirePlatformStaff();
  const params = (await searchParams) ?? {};
  const stepUp = first(params.stepUp);
  const callbackUrl = first(params.callbackUrl) ?? "/platform-admin";
  const error = errorCopy(first(params.error));

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12 text-zinc-950">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-normal text-[#E85A1E]">
          Platform Admin MFA
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-normal">
          Verify access
        </h1>
      </div>

      {error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </div>
      ) : null}

      <form
        action={verifyTotpAndIssueSession}
        className="rounded-md border border-zinc-200 bg-white p-6"
      >
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        {stepUp ? <input type="hidden" name="stepUp" value={stepUp} /> : null}
        <label className="block text-sm font-semibold text-zinc-800" htmlFor="token">
          Authenticator code
        </label>
        <div className="mt-3 flex gap-3">
          <input
            id="token"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            required
            className="w-44 rounded-md border border-zinc-300 px-3 py-2 text-lg font-semibold tracking-normal"
          />
          <button
            type="submit"
            className="rounded-md bg-[#FF6B2C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#E85A1E]"
          >
            Continue
          </button>
        </div>
      </form>

      <form
        action={useRecoveryCodeAction}
        className="mt-5 rounded-md border border-zinc-200 bg-white p-6"
      >
        <label
          className="block text-sm font-semibold text-zinc-800"
          htmlFor="recoveryCode"
        >
          Recovery code
        </label>
        <div className="mt-3 flex gap-3">
          <input
            id="recoveryCode"
            name="recoveryCode"
            autoComplete="one-time-code"
            className="w-44 rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm"
          />
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-5 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Use recovery code
          </button>
        </div>
      </form>
    </main>
  );
}
