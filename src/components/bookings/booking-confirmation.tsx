"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import {
  formatIndiaDateTime,
  formatIndiaTime,
} from "@/lib/india-date-time";

type BookingDetail = {
  id: string;
  bookingReference: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: string;
  createdAt: string;

  movie: {
    title: string;
    posterUrl: string | null;
    language: string;
    duration: number;
    certification: string;
  };

  theatre: {
    name: string;
    address: string;
    city: string;
  };

  screen: string;

  show: {
    startTime: string;
    endTime: string;
  };

  seats: {
    seatId: string;
    seatLabel: string;
    section: string;
    seatType: string;
    price: string;
  }[];
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

export default function BookingConfirmation({
  bookingId,
}: {
  bookingId: string;
}) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBooking() {
      try {
        const response = await fetch(
          `/api/bookings/${bookingId}`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
          },
        );

        const result =
          (await response.json()) as ApiResponse<BookingDetail>;

        if (!response.ok || !result.success || !result.data) {
          throw new Error(
            result.message ?? "Unable to retrieve booking.",
          );
        }

        if (!cancelled) {
          setBooking(result.data);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to retrieve booking.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadBooking();

    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <p className="text-sm text-zinc-400">
          Retrieving booking confirmation...
        </p>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h1 className="text-xl font-semibold text-white">
            Booking unavailable
          </h1>

          <p className="mt-3 text-sm text-red-400">
            {error ?? "Unable to retrieve this booking."}
          </p>

          <Link
            href="/bookings"
            className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black"
          >
            My bookings
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <section className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-6 text-center sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500 text-2xl text-emerald-400">
          ✓
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
          Booking confirmed
        </p>

        <h1 className="mt-2 text-3xl font-bold text-white">
          Your tickets are booked
        </h1>

        <p className="mt-3 text-sm text-zinc-400">
          Your seats have been confirmed successfully.
        </p>

        <div className="mt-7 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Booking reference
          </p>

          <p className="mt-2 font-mono text-2xl font-bold tracking-wider text-white">
            {booking.bookingReference}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">
          Booking details
        </h2>

        <h3 className="mt-5 text-xl font-semibold">
          {booking.movie.title}
        </h3>

        <p className="mt-2 text-sm text-zinc-400">
          {booking.theatre.name}, {booking.theatre.city}
        </p>

        <p className="mt-1 text-sm text-zinc-400">
          {booking.theatre.address}
        </p>

        <p className="mt-3 text-sm text-zinc-300">
          Screen: {booking.screen}
        </p>

        <p className="mt-1 text-sm text-zinc-300">
          {formatIndiaDateTime(booking.show.startTime)}
          {" · Ends "}
          {formatIndiaTime(booking.show.endTime)}
        </p>

        <div className="my-6 border-t border-zinc-800" />

        <h3 className="font-semibold text-white">
          Tickets
        </h3>

        <div className="mt-4 space-y-4">
          {booking.seats.map((seat) => (
            <div
              key={seat.seatId}
              className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-3 last:border-0"
            >
              <div>
                <p className="font-medium text-white">
                  {seat.seatLabel}
                </p>

                <p className="mt-1 text-xs text-zinc-500">
                  {seat.section} · {seat.seatType}
                </p>
              </div>

              <span className="text-sm text-zinc-300">
                {formatINR(seat.price)}
              </span>
            </div>
          ))}
        </div>

        <div className="my-6 border-t border-zinc-800" />

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-zinc-400">
            Total amount
          </span>

          <span className="text-2xl font-bold text-white">
            {formatINR(booking.totalAmount)}
          </span>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-amber-800 bg-amber-950/20 p-6">
        <h2 className="font-semibold text-amber-300">
          Payment pending
        </h2>

        <p className="mt-2 text-sm leading-6 text-zinc-300">
          Payment method: Cash on Delivery. Your booking is confirmed,
          but payment has not been collected. Pay at the theatre.
        </p>

        <p className="mt-3 text-xs uppercase tracking-wider text-amber-400">
          Payment status: {booking.paymentStatus}
        </p>
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/bookings"
          className="flex-1 rounded-xl bg-white px-5 py-3 text-center text-sm font-semibold text-black hover:bg-zinc-200"
        >
          View my bookings
        </Link>

        <Link
          href="/movies"
          className="flex-1 rounded-xl border border-zinc-700 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Browse movies
        </Link>
      </div>
    </main>
  );
}