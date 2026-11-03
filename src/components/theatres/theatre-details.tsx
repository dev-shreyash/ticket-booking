
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { fetchCatalogue } from "@/lib/catalogue-client";
import {
  formatIndiaDateTime,
  formatIndiaTime,
} from "@/lib/india-date-time";

import type {
  ApiResponse,
  PublicShow,
  PublicTheatre,
} from "@/types/catalogue";

type PublicTheatreDetails = PublicTheatre & {
  screens: Array<{
    id: string;
    name: string;
  }>;
};

type TheatreDetailsProps = {
  theatreId: string;
};

export default function TheatreDetails({
  theatreId,
}: TheatreDetailsProps) {
  const [theatre, setTheatre] = useState<PublicTheatreDetails | null>(null);
  const [shows, setShows] = useState<PublicShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ theatreId });

    Promise.all([
      fetchCatalogue<PublicTheatreDetails>(
        `/api/theatres/${theatreId}`,
        controller.signal,
      ),
      fetchCatalogue<PublicShow[]>(
        `/api/shows?${params.toString()}`,
        controller.signal,
      ),
    ])
      .then(([theatreResponse, showsResponse]) => {
        setTheatre(theatreResponse.data ?? null);
        setShows(showsResponse.data ?? []);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load theatre details.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [theatreId]);

  const movieGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        movie: PublicShow["movie"];
        shows: PublicShow[];
      }
    >();

    for (const show of shows) {
      const existingGroup = groups.get(show.movie.id);

      if (existingGroup) {
        existingGroup.shows.push(show);
      } else {
        groups.set(show.movie.id, {
          movie: show.movie,
          shows: [show],
        });
      }
    }

    return Array.from(groups.values());
  }, [shows]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-16 text-sm text-zinc-400">
        Loading theatre details...
      </div>
    );
  }

  if (error || !theatre) {
    return (
      <section className="mx-auto max-w-7xl px-5 py-16">
        <p role="alert" className="text-sm text-red-300">
          {error ?? "Theatre not found or unavailable."}
        </p>

        <Link
          href="/theatres"
          className="mt-5 inline-flex text-sm text-zinc-300 underline hover:text-white"
        >
          ← Back to theatres
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:py-14">
      <Link
        href="/theatres"
        className="text-sm text-zinc-400 transition hover:text-white"
      >
        ← Back to theatres
      </Link>

      {/* Theatre information */}
      <div className="mt-7 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
          Theatre details
        </p>

        <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {theatre.name}
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              {theatre.address}
            </p>

            <p className="mt-2 text-sm text-zinc-300">
              {theatre.city}
            </p>
          </div>

          <span className="w-fit shrink-0 rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300">
            {theatre.screenCount}{" "}
            {theatre.screenCount === 1 ? "screen" : "screens"}
          </span>
        </div>

        {/* Screens */}
        <div className="mt-8 border-t border-zinc-800 pt-6">
          <h2 className="text-sm font-semibold text-white">
            Available screens
          </h2>

          <div className="mt-3 flex flex-wrap gap-2">
            {theatre.screens.map((screen) => (
              <span
                key={screen.id}
                className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300"
              >
                {screen.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Movie and show listings */}
      <div className="mt-12">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Now showing
          </p>

          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Movies and showtimes
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            Explore upcoming screenings at {theatre.name}.
          </p>
        </div>

        {shows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center">
            <h3 className="font-medium text-zinc-200">
              No upcoming shows
            </h3>

            <p className="mt-2 text-sm text-zinc-500">
              There are currently no scheduled upcoming screenings at this theatre.
            </p>

            <Link
              href="/movies"
              className="mt-5 inline-flex text-sm text-zinc-300 underline hover:text-white"
            >
              Browse other movies
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {movieGroups.map(({ movie, shows: movieShows }) => (
              <article
                key={movie.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <Link
                      href={`/movies/${movie.id}`}
                      className="text-xl font-semibold text-white transition hover:text-zinc-300"
                    >
                      {movie.title}
                    </Link>

                    <p className="mt-2 text-sm text-zinc-400">
                      {movie.language} · {movie.duration} minutes ·{" "}
                      {movie.certification}
                    </p>
                  </div>

                  <span className="w-fit rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400">
                    {movieShows.length}{" "}
                    {movieShows.length === 1 ? "show" : "shows"}
                  </span>
                </div>

                <div className="mt-6 border-t border-zinc-800 pt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Available showtimes
                  </h3>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {movieShows.map((show) => (
                      <Link
                        key={show.id}
                        href={`/shows/${show.id}`}
                        className="group rounded-xl border border-zinc-700 bg-zinc-950/60 p-4 transition hover:border-zinc-500 hover:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        <p className="font-semibold text-white">
                          {formatIndiaDateTime(show.startTime)}
                        </p>

                        <p className="mt-2 text-sm text-zinc-400">
                          {show.screen.name}
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          Ends at {formatIndiaTime(show.endTime)}
                        </p>

                        <p className="mt-4 text-sm font-medium text-zinc-300 transition group-hover:text-white">
                          View show details →
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
