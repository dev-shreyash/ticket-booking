import { redirect } from "next/navigation";

import VerifyOtpForm from "@/components/auth/verify-otp-form";

type VerifyOtpPageProps = {
  searchParams: Promise<{
    identifier?: string | string[];
  }>;
};

export default async function VerifyOtpPage({
  searchParams,
}: VerifyOtpPageProps) {
  const params = await searchParams;

  const identifier = Array.isArray(params.identifier)
    ? params.identifier[0]
    : params.identifier;

  if (!identifier) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-md space-y-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl sm:p-9">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Account verification
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Verify your OTP
          </h1>

          <p className="text-sm leading-6 text-zinc-400">
            Enter the six-digit code to complete sign-in.
          </p>
        </div>

        <VerifyOtpForm identifier={identifier} />
      </section>
    </main>
  );
}