import LoginForm from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-md space-y-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl sm:p-9">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Movie Ticket Booking
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Welcome back
          </h1>

          <p className="text-sm leading-6 text-zinc-400">
            Enter your email address or Indian mobile number to continue.
          </p>
        </div>

        <LoginForm />

        <p className="text-center text-xs text-zinc-500">
          Authentication uses a demonstration OTP. No external SMS or email
          delivery is configured.
        </p>
      </section>
    </main>
  );
}