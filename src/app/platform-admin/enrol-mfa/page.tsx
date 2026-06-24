import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";
import { requirePlatformStaff } from "@/lib/platform-admin/access";
import { generateRecoveryCodes } from "@/lib/platform-admin/mfa";
import { enrolMfaAction } from "./actions";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function errorCopy(error?: string | string[]) {
  if (error === "code") return "That code did not verify. Try the current code from your authenticator app.";
  if (error === "recovery") return "Save the recovery codes before continuing.";
  return null;
}

export default async function EnrolMfaPage({ searchParams }: PageProps) {
  const { user } = await requirePlatformStaff();
  const params = (await searchParams) ?? {};
  const secret = generateSecret();
  const otpauth = generateURI({
    issuer: "Convo",
    label: `Convo Platform Admin:${user.email ?? user.id}`,
    secret,
  });
  const qrCode = await QRCode.toDataURL(otpauth);
  const recoveryCodes = generateRecoveryCodes();
  const error = errorCopy(params.error);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-12 text-zinc-950">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-normal text-[#E85A1E]">
          Platform Admin MFA
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-normal">
          Enrol authenticator app
        </h1>
      </div>

      {error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </div>
      ) : null}

      <form action={enrolMfaAction} className="space-y-8">
        <input type="hidden" name="secret" value={secret} />
        {recoveryCodes.map((code) => (
          <input key={code} type="hidden" name="recoveryCode" value={code} />
        ))}

        <section className="grid gap-6 rounded-md border border-zinc-200 bg-white p-6 md:grid-cols-[180px_1fr]">
          <img
            src={qrCode}
            alt="Authenticator app QR code"
            className="h-44 w-44 rounded-md border border-zinc-200"
          />
          <div>
            <h2 className="font-display text-xl font-semibold tracking-normal">
              Scan this code
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              Add Convo Platform Admin to your authenticator app, then enter the
              current six-digit code below.
            </p>
            <div className="mt-4 rounded-md bg-zinc-100 p-3 font-mono text-sm text-zinc-900">
              {secret}
            </div>
          </div>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-6">
          <h2 className="font-display text-xl font-semibold tracking-normal">
            Recovery codes
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {recoveryCodes.map((code) => (
              <code key={code} className="rounded bg-zinc-100 px-3 py-2 text-sm">
                {code}
              </code>
            ))}
          </div>
          <label className="mt-5 flex items-center gap-3 text-sm font-medium text-zinc-800">
            <input name="saved" type="checkbox" className="h-4 w-4" />
            I have saved these recovery codes
          </label>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-6">
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
        </section>
      </form>
    </main>
  );
}
