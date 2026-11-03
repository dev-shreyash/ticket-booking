"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

import { fetchCatalogue } from "@/lib/catalogue-client";
import { formatIndiaDate } from "@/lib/india-date-time";
import type { ApiResponse, Pagination, PublicMovie } from "@/types/catalogue";

export default function MovieCatalogue() {
  const [movies, setMovies] = useState<PublicMovie[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: "12" });

    if (search) params.set("search", search);
    if (language) params.set("language", language);

    setLoading(true);
    setError(null);

    fetchCatalogue<PublicMovie[]>(`/api/movies?${params.toString()}`, controller.signal)
      .then((response: ApiResponse<PublicMovie[]>) => {
        setMovies(response.data ?? []);
        setPagination(response.pagination ?? null);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "Unable to load movies.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, search, language, reload]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  }

  function handleLanguageChange(value: string) {
    setPage(1);
    setLanguage(value);
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:py-14">
      <div className="mb-8 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Now showing</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Discover movies</h1>
        <p className="max-w-2xl text-sm leading-6 text-zinc-400">
          Browse movies and find upcoming shows at theatres near you.
        </p>
      </div>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search movie titles..."
            aria-label="Search movie titles"
            maxLength={100}
            className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-zinc-500"
          />
          <button type="submit" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-200">
            Search
          </button>
        </form>

        <select
          value={language}
          onChange={(event) => handleLanguageChange(event.target.value)}
          aria-label="Filter by language"
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-500"
        >
          <option value="">All languages</option>
          <option value="English">English</option>
          <option value="Hindi">Hindi</option>
        </select>
      </div>

      {loading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Loading movies">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-80 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div role="alert" className="rounded-xl border border-red-900/70 bg-red-950/30 p-5 text-sm text-red-300">
          {error}
          <button onClick={() => setReload((current) => current + 1)} className="ml-3 underline">Retry</button>
        </div>
      )}

      {!loading && !error && movies.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-800 px-6 py-16 text-center">
          <h2 className="text-lg font-medium">No movies found</h2>
          <p className="mt-2 text-sm text-zinc-500">Try another title or remove the language filter.</p>
        </div>
      )}

      {!loading && !error && movies.length > 0 && (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {movies.map((movie) => (
              <article key={movie.id} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 transition hover:-translate-y-1 hover:border-zinc-600">
                <Link href={`/movies/${movie.id}`} className="block">
                  <div
                    role="img"
                    aria-label={`${movie.title} poster`}
                    className="relative flex h-64 items-end overflow-hidden bg-gradient-to-br from-zinc-700 via-zinc-900 to-black p-5"
                    style={movie.posterUrl ? { backgroundImage: `linear-gradient(to top, rgba(0,0,0,.85), rgba(0,0,0,.05)), url("${movie.posterUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                  >
                    <span className="line-clamp-2 text-2xl font-semibold leading-tight text-white drop-shadow">{movie.title}</span>
                  </div>
                  <div className="space-y-3 p-5">
                    <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                      <span className="rounded-full bg-zinc-800 px-2.5 py-1">{movie.language}</span>
                      <span className="rounded-full bg-zinc-800 px-2.5 py-1">{movie.certification}</span>
                    </div>
                    <p className="line-clamp-1 text-sm text-zinc-300">{movie.genre}</p>
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>{movie.duration} min</span>
                      <span>Released {formatIndiaDate(movie.releaseDate)}</span>
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-9 flex items-center justify-center gap-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-400">Page {pagination.page} of {pagination.totalPages}</span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
