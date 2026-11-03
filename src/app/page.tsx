import Link from "next/link";

import AuthStatus from "@/components/auth/auth-status";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-10 px-6 py-16">
      <section className="space-y-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
          Movie Ticket Booking
        </p>

        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          Find your next movie night.
        </h1>

        <p className="mx-auto max-w-2xl text-base leading-7 text-zinc-400">
          Browse movies, compare local theatre screenings and select a show.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/movies"
            className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-200"
          >
            Browse movies
          </Link>

          <Link
            href="/theatres"
            className="rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-900"
          >
            Browse theatres
          </Link>
        </div>
      </section>

     
    </main>
  );
}