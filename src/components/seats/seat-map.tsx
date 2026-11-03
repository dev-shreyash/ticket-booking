
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createSeatHoldRequest } from "@/lib/holds-client";
import {
  formatIndiaDateTime,
  formatIndiaTime,
} from "@/lib/india-date-time";

import type {
  SeatMapApiResponse,
  SeatMapData,
  SeatMapSeat,
} from "@/modules/seats/seat.types";

const MAX_SELECTED_SEATS = 6;
const REFRESH_INTERVAL_MS = 12_000;

type SeatMapProps = {
  showId: string;
};

function toPaise(amount: string): number {
  const [rupees, fraction = ""] = amount.split(".");

  return (
    Number(rupees) * 100 +
    Number(fraction.padEnd(2, "0").slice(0, 2))
  );
}

function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(paise / 100);
}

export default function SeatMap({ showId }: SeatMapProps) {
  const router = useRouter();

  const [seatMap, setSeatMap] = useState<SeatMapData | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingHold, setCreatingHold] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIdsRef = useRef<string[]>([]);
  const requestInFlightRef = useRef(false);

  // Prevent multiple simultaneous hold-creation requests.
  const creatingHoldRef = useRef(false);

  const updateSelection = useCallback((ids: string[]) => {
    selectedIdsRef.current = ids;
    setSelectedSeatIds(ids);
  }, []);

  const loadSeatMap = useCallback(
    async (backgroundRefresh = false) => {
      if (requestInFlightRef.current) {
        return;
      }

      requestInFlightRef.current = true;

      if (backgroundRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await fetch(
          `/api/shows/${showId}/seats`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
          },
        );

        const result =
          (await response.json()) as SeatMapApiResponse;

        if (!response.ok || !result.success || !result.data) {
          throw new Error(
            result.message ?? "Unable to load seat map.",
          );
        }

        const nextData = result.data;

        const availableIds = new Set(
          nextData.sections.flatMap((section) =>
            section.rows.flatMap((row) =>
              row.seats
                .filter((seat) => seat.status === "AVAILABLE")
                .map((seat) => seat.id),
            ),
          ),
        );

        const currentSelection = selectedIdsRef.current;

        const retainedIds = currentSelection.filter((id) =>
          availableIds.has(id),
        );

        const removedCount =
          currentSelection.length - retainedIds.length;

        if (removedCount > 0) {
          updateSelection(retainedIds);

        //   toast.warning(
        //     `${removedCount} selected seat(s) are no longer available and have been removed.`,
        //   );
        }

        setSeatMap(nextData);
        setError(null);
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Unable to retrieve seat availability.";

        setError(message);
      } finally {
        requestInFlightRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showId, updateSelection],
  );

  // Initial load, periodic availability refresh and focus refresh.
  useEffect(() => {
    void loadSeatMap();

    const interval = window.setInterval(() => {
      void loadSeatMap(true);
    }, REFRESH_INTERVAL_MS);

    function handleFocus() {
      if (document.visibilityState === "visible") {
        void loadSeatMap(true);
      }
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadSeatMap]);

  const selectedSeats = useMemo(() => {
    if (!seatMap) {
      return [];
    }

    const selectedSet = new Set(selectedSeatIds);

    return seatMap.sections.flatMap((section) =>
      section.rows.flatMap((row) =>
        row.seats
          .filter((seat) => selectedSet.has(seat.id))
          .map((seat) => ({
            ...seat,
            sectionName: section.name,
            price: section.price,
          })),
      ),
    );
  }, [seatMap, selectedSeatIds]);

  const totalPaise = selectedSeats.reduce(
    (total, seat) => total + toPaise(seat.price),
    0,
  );

  function toggleSeat(seat: SeatMapSeat) {
    if (creatingHoldRef.current) {
      return;
    }

    if (seat.status !== "AVAILABLE") {
      return;
    }

    const current = selectedIdsRef.current;

    if (current.includes(seat.id)) {
      updateSelection(
        current.filter((id) => id !== seat.id),
      );

      return;
    }

    if (current.length >= MAX_SELECTED_SEATS) {
      toast.error(
        `You can select a maximum of ${MAX_SELECTED_SEATS} seats.`,
      );

      return;
    }

    updateSelection([...current, seat.id]);
  }

  // Create a real server-side seat hold before proceeding.
  async function handleContinue() {
    if (creatingHoldRef.current) {
      return;
    }

    const requestedSeatIds = [...selectedIdsRef.current];

    if (requestedSeatIds.length === 0) {
      toast.error("Please select at least one seat.");
      return;
    }

    if (requestedSeatIds.length > MAX_SELECTED_SEATS) {
      toast.error(
        `You can select a maximum of ${MAX_SELECTED_SEATS} seats.`,
      );
      return;
    }

    creatingHoldRef.current = true;
    setCreatingHold(true);

    try {
      const hold = await createSeatHoldRequest(
        showId,
        requestedSeatIds,
      );

      toast.success("Seats held successfully for 2 minutes.");

      // Navigate only after the server confirms successful allocation.
      router.push(`/holds/${hold.holdId}`);
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Unable to reserve the selected seats temporarily.";

      toast.error(message);

      // Refresh availability after a conflict or failed allocation.
      void loadSeatMap(true);
    } finally {
      creatingHoldRef.current = false;
      setCreatingHold(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-16">
        <div className="animate-pulse space-y-5">
          <div className="h-8 w-64 rounded-lg bg-zinc-800" />
          <div className="h-64 rounded-2xl bg-zinc-900" />
          <div className="h-40 rounded-2xl bg-zinc-900" />
        </div>
      </div>
    );
  }

  // Show the full error screen only when no seat map has loaded.
 // Show the error screen whenever the seat map is unavailable.
if (!seatMap) {
  return (
    <section className="mx-auto max-w-4xl px-5 py-16">
      <div
        role="alert"
        className="rounded-2xl border border-red-900 bg-red-950/20 p-6"
      >
        <h1 className="text-lg font-semibold">
          Unable to load seat map
        </h1>

        <p className="mt-2 text-sm text-red-300">
          {error ?? "Show or seating information is unavailable."}
        </p>

        <button
          type="button"
          onClick={() => void loadSeatMap()}
          className="mt-5 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black"
        >
          Retry
        </button>

        <Link
          href="/movies"
          className="ml-4 text-sm text-zinc-400 underline"
        >
          Browse movies
        </Link>
      </div>
    </section>
  );
}

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:py-14">
      {/* Background refresh error banner */}
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-300"
        >
          Availability refresh failed. The displayed seat information may
          be outdated.

          <button
            type="button"
            onClick={() => void loadSeatMap(true)}
            className="ml-2 underline"
          >
            Retry
          </button>
        </div>
      )}

      <Link
        href="/movies"
        className="text-sm text-zinc-400 hover:text-white"
      >
        ← Back to movies
      </Link>

      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Select your seats
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {seatMap.show.movie.title}
            </h1>
          </div>

          <span className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-300">
            {seatMap.show.screen.name}
          </span>
        </div>

        <p className="text-sm text-zinc-400">
          {seatMap.show.theatre.name},{" "}
          {seatMap.show.theatre.city}
        </p>

        <p className="text-sm text-zinc-500">
          {formatIndiaDateTime(seatMap.show.startTime)}
          {" · Ends "}
          {formatIndiaTime(seatMap.show.endTime)}
        </p>
      </div>

      {/* Availability summary */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="Total seats"
          value={seatMap.summary.totalSeats}
        />

        <SummaryCard
          label="Available"
          value={seatMap.summary.availableSeats}
        />

        <SummaryCard
          label="Held"
          value={seatMap.summary.heldSeats}
        />

        <SummaryCard
          label="Booked"
          value={seatMap.summary.bookedSeats}
        />
      </div>

      {/* Availability legend */}
      <div className="mt-8 flex flex-wrap gap-4 text-xs text-zinc-400">
        <LegendItem symbol="○" label="Available" />
        <LegendItem symbol="✓" label="Selected" />
        <LegendItem symbol="H" label="Held" />
        <LegendItem symbol="B" label="Booked" />
      </div>

      {/* Screen indicator */}
      <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-8">
        <div className="mx-auto mb-12 max-w-xl text-center">
          <div className="h-1.5 rounded-full bg-gradient-to-r from-transparent via-zinc-400 to-transparent" />

          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.4em] text-zinc-500">
            Screen this side
          </p>
        </div>

        {seatMap.sections.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-500">
            No seating sections are configured for this screen.
          </p>
        )}

        <div className="space-y-12">
          {seatMap.sections.map((section) => (
            <div key={section.id}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                <div>
                  <h2 className="font-semibold">
                    {section.name}
                  </h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    {section.category}
                  </p>
                </div>

                <p className="text-sm font-semibold text-zinc-200">
                  {formatINR(toPaise(section.price))}
                  <span className="ml-1 text-xs font-normal text-zinc-500">
                    / seat
                  </span>
                </p>
              </div>

              {section.rows.length === 0 && (
                <p className="text-sm text-zinc-500">
                  No seats in this section.
                </p>
              )}

              <div className="space-y-5">
                {section.rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center gap-3 sm:gap-5"
                  >
                    <span className="w-5 shrink-0 text-sm font-semibold text-zinc-500">
                      {row.label}
                    </span>

                    <div className="flex min-w-0 flex-1 flex-wrap justify-center gap-2 sm:gap-3">
                      {row.seats.map((seat) => {
                        const selected =
                          selectedSeatIds.includes(seat.id);

                        const unavailable =
                          seat.status !== "AVAILABLE";

                        let buttonClass =
                          "border-zinc-600 bg-zinc-900 text-zinc-200 hover:border-zinc-300 hover:bg-zinc-800";

                        if (selected) {
                          buttonClass =
                            "border-emerald-300 bg-emerald-300 text-zinc-950";
                        } else if (seat.status === "HELD") {
                          buttonClass =
                            "border-amber-700 bg-amber-950 text-amber-300 cursor-not-allowed";
                        } else if (seat.status === "BOOKED") {
                          buttonClass =
                            "border-red-900 bg-red-950 text-red-300 cursor-not-allowed";
                        }

                        return (
                          <button
                            key={seat.id}
                            type="button"
                            disabled={unavailable || creatingHold}
                            aria-label={`${seat.label}, ${selected ? "selected" : seat.status.toLowerCase()}`}
                            aria-pressed={selected}
                            title={`${seat.label} · ${seat.seatType} · ${seat.status}`}
                            onClick={() => toggleSeat(seat)}
                            className={`flex h-9 min-w-9 items-center justify-center gap-0.5 rounded-lg border px-1.5 text-xs font-semibold transition disabled:opacity-100 ${buttonClass}`}
                          >
                            <span>{seat.seatNumber}</span>

                            {selected && (
                              <span aria-hidden="true">✓</span>
                            )}

                            {!selected &&
                              seat.status === "HELD" && (
                                <span aria-hidden="true">H</span>
                              )}

                            {!selected &&
                              seat.status === "BOOKED" && (
                                <span aria-hidden="true">B</span>
                              )}
                          </button>
                        );
                      })}
                    </div>

                    <span className="w-5 shrink-0 text-right text-sm font-semibold text-zinc-500">
                      {row.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {seatMap.summary.availableSeats === 0 && (
          <div className="mt-10 rounded-xl border border-zinc-800 p-5 text-center">
            <p className="text-sm font-medium">
              No available seats
            </p>

            <p className="mt-1 text-xs text-zinc-500">
              This show currently has no selectable seats.
            </p>
          </div>
        )}
      </div>

      {/* Refresh status */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          Availability refreshes every 12 seconds and when you return to this tab.
        </span>

        <span aria-live="polite">
          {refreshing
            ? "Refreshing availability..."
            : "Availability loaded"}
        </span>
      </div>

      {/* Selected seats and price summary */}
      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              Your selection
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              {selectedSeatIds.length} of {MAX_SELECTED_SEATS} seats selected
            </p>
          </div>

          <p className="text-2xl font-semibold tabular-nums">
            {formatINR(totalPaise)}
          </p>
        </div>

        {selectedSeats.length > 0 ? (
          <div className="mt-5 space-y-3">
            {selectedSeats.map((seat) => (
              <div
                key={seat.id}
                className="flex items-center justify-between border-b border-zinc-800 pb-3 text-sm"
              >
                <div>
                  <span className="font-medium">
                    {seat.label}
                  </span>

                  <span className="ml-2 text-xs text-zinc-500">
                    {seat.sectionName}
                  </span>
                </div>

                <span className="text-zinc-300">
                  {formatINR(toPaise(seat.price))}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-zinc-500">
            Select available seats to see your price summary.
          </p>
        )}

        <button
          type="button"
          onClick={handleContinue}
          disabled={
            selectedSeatIds.length === 0 || creatingHold
          }
          className="mt-6 w-full rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {creatingHold ? "Holding seats..." : "Continue"}
        </button>

        <p className="mt-3 text-xs leading-5 text-zinc-500">
          Your selection is not reserved until the server confirms the hold.
          Once confirmed, your seats are held for 120 seconds.
        </p>
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs text-zinc-500">{label}</p>

      <p className="mt-2 text-2xl font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}

function LegendItem({
  symbol,
  label,
}: {
  symbol: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 min-w-6 items-center justify-center rounded-md border border-zinc-700 text-xs font-semibold">
        {symbol}
      </span>

      <span>{label}</span>
    </div>
  );
}
