"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { fetchCatalogue } from "@/lib/catalogue-client";
import { formatIndiaDate, formatIndiaDateTime, formatIndiaTime } from "@/lib/india-date-time";
import type { ApiResponse, PublicMovie, PublicShow } from "@/types/catalogue";

type MovieDetailsProps = { movieId: string };

export default function MovieDetails({ movieId }: MovieDetailsProps) {
  const [movie, setMovie] = useState<PublicMovie | null>(null);
  const [movieLoading, setMovieLoading] = useState(true);
  const [movieError, setMovieError] = useState<string | null>(null);
  const [shows, setShows] = useState<PublicShow[]>([]);
  const [showsLoading, setShowsLoading] = useState(true);
  const [showsError, setShowsError] = useState<string | null>(null);
  const [date, setDate] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setMovieLoading(true);
    setMovieError(null);

    fetchCatalogue<PublicMovie>(`/api/movies/${movieId}`, controller.signal)
      .then((response: ApiResponse<PublicMovie>) => setMovie(response.data ?? null))
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setMovieError(caught instanceof Error ? caught.message : "Unable to load movie.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setMovieLoading(false);
      });

    return () => controller.abort();
  }, [movieId]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ movieId });
    if (date) params.set("date", date);

    setShowsLoading(true);
    setShowsError(null);

    fetchCatalogue<PublicShow[]>(`/api/shows?${params.toString()}`, controller.signal)
      .then((response: ApiResponse<PublicShow[]>) => setShows(response.data ?? []))
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setShowsError(caught instanceof Error ? caught.message : "Unable to load shows.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setShowsLoading(false);
      });

    return () => controller.abort();
  }, [movieId, date]);

  if (movieLoading) {
    return <div className="mx-auto max-w-7xl px-5 py-16 text-sm text-zinc-400">Loading movie details...</div>;
  }

  if (movieError || !movie) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-16">
        <p role="alert" className="text-sm text-red-300">{movieError ?? "Movie not found."}</p>
        <Link href="/movies" className="mt-4 inline-block text-sm text-zinc-300 underline">Back to movies</Link>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:py-14">
      <Link href="/movies" className="text-sm text-zinc-400 hover:text-white">← All movies</Link>

      <div className="mt-6 grid gap-8 md:grid-cols-[280px_1fr]">
        <div
          role="img"
          aria-label={`${movie.title} poster`}
          className="min-h-80 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-700 via-zinc-900 to-black bg-cover bg-center"
          style={movie.posterUrl ? { backgroundImage: `linear-gradient(to top, rgba(0,0,0,.55), rgba(0,0,0,.05)), url("${movie.posterUrl}")` } : undefined}
        />

        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Movie details</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{movie.title}</h1>
            <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
              {[movie.language, movie.certification, `${movie.duration} minutes`].map((item) => (
                <span key={item} className="rounded-full border border-zinc-700 px-3 py-1.5">{item}</span>
              ))}
            </div>
          </div>

          <p className="max-w-3xl text-sm leading-7 text-zinc-300">{movie.description}</p>

          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div><p className="text-zinc-500">Genre</p><p className="mt-1 text-zinc-200">{movie.genre}</p></div>
            <div><p className="text-zinc-500">Release date</p><p className="mt-1 text-zinc-200">{formatIndiaDate(movie.releaseDate)}</p></div>
          </div>
        </div>
      </div>

      <div className="mt-14 border-t border-zinc-800 pt-9">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Find a screening</p>
            <h2 className="mt-2 text-2xl font-semibold">Upcoming shows</h2>
          </div>
          <label className="flex flex-col gap-2 text-xs text-zinc-400">
            Filter by date (India)
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500"
            />
          </label>
        </div>

        {showsLoading && <p className="mt-6 text-sm text-zinc-400">Loading upcoming shows...</p>}
        {!showsLoading && showsError && <p role="alert" className="mt-6 text-sm text-red-300">{showsError}</p>}
        {!showsLoading && !showsError && shows.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
            No upcoming shows found{date ? " for this date" : ""}.
          </div>
        )}

        {!showsLoading && !showsError && shows.length > 0 && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {shows.map((show) => (
              <article key={show.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{show.screen.theatre.name}</h3>
                    <p className="mt-1 text-sm text-zinc-400">{show.screen.theatre.address}, {show.screen.theatre.city}</p>
                    <p className="mt-2 text-xs text-zinc-500">{show.screen.name}</p>
                  </div>
                  <div className="shrink-0 rounded-xl border border-zinc-700 px-3 py-2 text-sm font-medium text-white">
                    {formatIndiaTime(show.startTime)}
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-zinc-400">{formatIndiaDateTime(show.startTime)}</p>
                  <Link href={`/shows/${show.id}`} className="inline-flex justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-200">
                    Select show
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
