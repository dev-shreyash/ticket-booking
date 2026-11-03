"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { fetchCatalogue } from "@/lib/catalogue-client";

import {
  formatIndiaDateTime,
  formatIndiaTime,
} from "@/lib/india-date-time";

import type {
  ApiResponse,
  PublicShow,
} from "@/types/catalogue";

type ShowDetailsProps = {
  showId: string;
};

export default function ShowDetails({
  showId,
}: ShowDetailsProps) {
  const [show, setShow] = useState<PublicShow | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetchCatalogue<PublicShow>(
      `/api/shows/${showId}`,
      controller.signal,
    )
      .then((response: ApiResponse<PublicShow>) => {
        setShow(response.data ?? null);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load show.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [showId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-16 text-sm text-zinc-400">
        Loading show details...
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-16">
        <p role="alert" className="text-sm text-red-300">
          {error ?? "Show not found or no longer available."}
        </p>

        <Link
          href="/movies"
          className="mt-4 inline-block text-sm text-zinc-300 underline"
        >
          Browse movies
        </Link>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-5 py-12">
      <Link
        href={`/movies/${show.movie.id}`}
        className="text-sm text-zinc-400 hover:text-white"
      >
        ← Back to movie
      </Link>

      <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
          Selected screening
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {show.movie.title}
        </h1>

        <p className="mt-2 text-sm text-zinc-400">
          {show.movie.language} · {show.movie.duration} minutes ·{" "}
          {show.movie.certification}
        </p>

        <div className="mt-8 grid gap-6 border-t border-zinc-800 pt-7 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Theatre
            </p>

            <h2 className="mt-2 font-semibold">
              {show.screen.theatre.name}
            </h2>

            <p className="mt-1 text-sm leading-6 text-zinc-400">
              {show.screen.theatre.address},{" "}
              {show.screen.theatre.city}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Screen
            </p>

            <p className="mt-2 font-semibold">
              {show.screen.name}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Date and time
            </p>

            <p className="mt-2 font-semibold">
              {formatIndiaDateTime(show.startTime)}
            </p>

            <p className="mt-1 text-sm text-zinc-400">
              Ends at {formatIndiaTime(show.endTime)}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Show status
            </p>

            <p className="mt-2 font-semibold text-emerald-300">
              Scheduled
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-zinc-700 bg-zinc-950/70 p-5">
          <h2 className="font-medium">
            Choose your seats
          </h2>

          <p className="mt-2 text-sm leading-6 text-zinc-400">
            View the seating layout and check current availability for this show.
          </p>

          <Link
            href={`/shows/${show.id}/seats`}
            className="mt-4 inline-flex w-full justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 sm:w-auto"
          >
            Select seats
          </Link>

          <p className="mt-3 text-xs text-zinc-500">
            Selecting seats does not reserve them. A temporary hold will
            be created in the next implementation phase.
          </p>
        </div>
      </div>
    </section>
  );
}