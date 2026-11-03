
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

import { fetchCatalogue } from "@/lib/catalogue-client";
import type { ApiResponse, Pagination, PublicTheatre } from "@/types/catalogue";

export default function TheatreCatalogue() {
  const [theatres, setTheatres] = useState<PublicTheatre[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [cityDraft, setCityDraft] = useState("");
  const [city, setCity] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      limit: "12",
    });

    if (city) params.set("city", city);

    setLoading(true);
    setError(null);

    fetchCatalogue<PublicTheatre[]>(
      `/api/theatres?${params.toString()}`,
      controller.signal,
    )
      .then((response: ApiResponse<PublicTheatre[]>) => {
        setTheatres(response.data ?? []);
        setPagination(response.pagination ?? null);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load theatres.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [page, city, reload]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setCity(cityDraft.trim());
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:py-14">
      <div className="mb-8 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
          Our locations
        </p>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Browse theatres
        </h1>

        <p className="text-sm text-zinc-400">
          Find participating theatres, explore their movies and check showtimes.
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-8 flex max-w-xl gap-2">
        <input
          value={cityDraft}
          onChange={(event) => setCityDraft(event.target.value)}
          placeholder="Filter by city, e.g. Thane"
          aria-label="Filter theatres by city"
          maxLength={120}
          className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-zinc-500"
        />

        <button
          type="submit"
          className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-200"
        >
          Filter
        </button>
      </form>

      {loading && (
        <p className="text-sm text-zinc-400">Loading theatres...</p>
      )}

      {!loading && error && (
        <div role="alert" className="text-sm text-red-300">
          {error}

          <button
            onClick={() => setReload((current) => current + 1)}
            className="ml-3 underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && theatres.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-sm text-zinc-500">
          No theatres found for this city.
        </div>
      )}

      {!loading && !error && theatres.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {theatres.map((theatre) => (
              <Link
                key={theatre.id}
                href={`/theatres/${theatre.id}`}
                aria-label={`Explore ${theatre.name}, ${theatre.city}`}
                className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-950"
              >
                <article className="h-full rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition duration-200 group-hover:border-zinc-600 group-hover:bg-zinc-900 group-focus-visible:border-zinc-500">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        {theatre.name}
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        {theatre.address}
                      </p>

                      <p className="mt-3 text-sm text-zinc-300">
                        {theatre.city}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300">
                      {theatre.screenCount}{" "}
                      {theatre.screenCount === 1 ? "screen" : "screens"}
                    </span>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4">
                    <span className="text-sm text-zinc-400 transition group-hover:text-white">
                      Explore movies and showtimes
                    </span>

                    <span
                      aria-hidden="true"
                      className="text-lg text-zinc-500 transition group-hover:translate-x-1 group-hover:text-white"
                    >
                      →
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-9 flex items-center justify-center gap-4">
              <button
                disabled={page <= 1}
                onClick={() =>
                  setPage((current) => Math.max(1, current - 1))
                }
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm disabled:opacity-40"
              >
                Previous
              </button>

              <span className="text-sm text-zinc-400">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm disabled:opacity-40"
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
