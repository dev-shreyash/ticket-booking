"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { toast } from "sonner";

import {
  formatIndiaDateTime,
} from "@/lib/india-date-time";

type BookingItem = {
  id: string;
  bookingReference: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: string;
  createdAt: string;

  movie: {
    id: string;
    title: string;
    posterUrl: string | null;
  };

  theatre: {
    name: string;
    city: string;
  };

  screen: string;
  showStartTime: string;

  seats: {
    seatLabel: string;
    section: string;
    seatType: string;
    price: string;
  }[];
};

type BookingListResponse = {
  items: BookingItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
  };
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

function formatINR(amount: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export default function BookingHistory() {
  const [items, setItems] = useState<BookingItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadBookings(
    requestedPage: number,
    append: boolean,
  ) {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch(
        `/api/bookings?page=${requestedPage}&pageSize=10`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        },
      );

      const result =
        (await response.json()) as ApiResponse<BookingListResponse>;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(
          result.message ?? "Unable to retrieve bookings.",
        );
      }

      setItems((current) =>
        append
          ? [...current, ...result.data!.items]
          : result.data!.items,
      );

      setPage(result.data.pagination.page);
      setHasNextPage(result.data.pagination.hasNextPage);
      setError(null);
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Unable to retrieve bookings.";

      setError(message);

      if (!append) {
        toast.error(message);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadBookings(1, false);
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-16">
        <p className="text-sm text-zinc-400">
          Loading your bookings...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Account
        </p>

        <h1 className="mt-2 text-3xl font-bold text-white">
          My bookings
        </h1>

        <p className="mt-2 text-sm text-zinc-400">
          Your confirmed movie ticket bookings.
        </p>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-900 bg-red-950/20 p-4 text-sm text-red-300">
          {error}

          <button
            type="button"
            onClick={() => void loadBookings(page, false)}
            className="ml-3 underline"
          >
            Retry
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 text-center">
          <h2 className="text-lg font-semibold text-white">
            No bookings yet
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            Your confirmed bookings will appear here.
          </p>

          <Link
            href="/movies"
            className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black"
          >
            Explore movies
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {items.map((booking) => (
            <article
              key={booking.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {booking.movie.title}
                  </h2>

                  <p className="mt-2 text-sm text-zinc-400">
                    {booking.theatre.name}, {booking.theatre.city}
                  </p>

                  <p className="mt-1 text-sm text-zinc-400">
                    Screen: {booking.screen}
                  </p>

                  <p className="mt-1 text-sm text-zinc-400">
                    {formatIndiaDateTime(booking.showStartTime)}
                  </p>
                </div>

                <span className="rounded-full border border-emerald-800 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                  {booking.status}
                </span>
              </div>

              <div className="my-5 border-t border-zinc-800" />

              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className="text-xs text-zinc-500">
                    Booking reference
                  </p>

                  <p className="mt-1 font-mono text-sm font-semibold text-white">
                    {booking.bookingReference}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-zinc-500">
                    Seats
                  </p>

                  <p className="mt-1 text-sm text-white">
                    {booking.seats
                      .map((seat) => seat.seatLabel)
                      .join(", ")}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-zinc-500">
                    Total
                  </p>

                  <p className="mt-1 text-sm font-semibold text-white">
                    {formatINR(booking.totalAmount)}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-amber-400">
                  Cash on Delivery · Payment {booking.paymentStatus}
                </p>

                <Link
                  href={`/bookings/confirmation/${booking.id}`}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  View booking
                </Link>
              </div>
            </article>
          ))}

          {hasNextPage && (
            <button
              type="button"
              onClick={() => void loadBookings(page + 1, true)}
              disabled={loadingMore}
              className="w-full rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      )}
    </main>
  );
}