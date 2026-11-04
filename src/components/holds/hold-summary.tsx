
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

import {
    formatIndiaDateTime,
    formatIndiaTime,
} from "@/lib/india-date-time";

import type {
    SeatMapApiResponse,
    SeatMapData,
} from "@/modules/seats/seat.types";

import DocumentUploader from "@/components/documents/document-uploader";

type HoldData = {
    holdId: string;
    showId: string;
    status: string;
    expiresAt: string;
    remainingSeconds: number;
    seatCount: number;
    seatIds: string[];
};

type ApiResponse<T> = {
    success: boolean;
    message?: string;
    data?: T;
};

type BookingResponse = {
    id: string;
    bookingReference: string;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    totalAmount: string;
    createdAt: string;
};

type CheckoutSeat = {
    id: string;
    label: string;
    sectionName: string;
    seatType: string;
    price: string;
};

function formatINR(amount: string | number) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(amount));
}

function formatCountdown(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
        remainingSeconds,
    ).padStart(2, "0")}`;
}

function getIdempotencyKey(holdId: string): string {
    const storageKey = `movie-booking:confirmation:${holdId}`;

    const existing = sessionStorage.getItem(storageKey);

    if (existing) {
        return existing;
    }

    const created = crypto.randomUUID();

    sessionStorage.setItem(storageKey, created);

    return created;
}

export default function HoldSummary({
    holdId,
}: {
    holdId: string;
}) {
    const router = useRouter();

    const [hold, setHold] = useState<HoldData | null>(null);
    const [seatMap, setSeatMap] = useState<SeatMapData | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [confirming, setConfirming] = useState(false);
    const [releasing, setReleasing] = useState(false);

    const [now, setNow] = useState(Date.now());

    const confirmInFlightRef = useRef(false);
    const releaseInFlightRef = useRef(false);
    const automaticReleaseStarted = useRef(false);

    // Document eligibility state
    const [hasRequiredDocument, setHasRequiredDocument] = useState(false);
    const [documentsLoading, setDocumentsLoading] = useState(true);

    // Always return to the existing seat-selection page.
    function returnToSeatSelection(showId: string) {
        router.replace(`/shows/${showId}/seats`);
    }

    const handleDocumentEligibilityChange = useCallback(
        (eligible: boolean, loading: boolean) => {
            setHasRequiredDocument(eligible);
            setDocumentsLoading(loading);
        },
        [],
    );

    const loadCheckout = useCallback(async () => {
        try {
            const holdResponse = await fetch(`/api/holds/${holdId}`, {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
            });

            const holdResult =
                (await holdResponse.json()) as ApiResponse<HoldData>;

            if (
                !holdResponse.ok ||
                !holdResult.success ||
                !holdResult.data
            ) {
                throw new Error(
                    holdResult.message ?? "Unable to retrieve your hold.",
                );
            }

            const currentHold = holdResult.data;
            setHold(currentHold);

            const seatResponse = await fetch(
                `/api/shows/${currentHold.showId}/seats`,
                {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store",
                },
            );

            const seatResult =
                (await seatResponse.json()) as SeatMapApiResponse;

            if (
                !seatResponse.ok ||
                !seatResult.success ||
                !seatResult.data
            ) {
                throw new Error(
                    seatResult.message ?? "Unable to retrieve show information.",
                );
            }

            setSeatMap(seatResult.data);
            setError(null);
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Unable to load checkout information.",
            );
        } finally {
            setLoading(false);
        }
    }, [holdId]);

    useEffect(() => {
        void loadCheckout();

        const interval = window.setInterval(() => {
            void loadCheckout();
        }, 15000);

        return () => window.clearInterval(interval);
    }, [loadCheckout]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => window.clearInterval(interval);
    }, []);

    const remainingSeconds = useMemo(() => {
        if (!hold || hold.status !== "ACTIVE") {
            return 0;
        }

        return Math.max(
            0,
            Math.ceil(
                (new Date(hold.expiresAt).getTime() - now) / 1000,
            ),
        );
    }, [hold, now]);

    const selectedSeats = useMemo<CheckoutSeat[]>(() => {
        if (!hold || !seatMap) {
            return [];
        }

        const selectedIds = new Set(hold.seatIds);

        return seatMap.sections.flatMap((section) =>
            section.rows.flatMap((row) =>
                row.seats
                    .filter((seat) => selectedIds.has(seat.id))
                    .map((seat) => ({
                        id: seat.id,
                        label: seat.label,
                        sectionName: section.name,
                        seatType: seat.seatType,
                        price: section.price,
                    })),
            ),
        );
    }, [hold, seatMap]);

    const estimatedTotal = selectedSeats.reduce(
        (total, seat) => total + Number(seat.price),
        0,
    );

    const active = hold?.status === "ACTIVE";

    const expired =
        hold?.status === "EXPIRED" ||
        (active && remainingSeconds === 0);

    // Release a hold and return to its seat-selection page.
    const releaseHold = useCallback(
        async (redirectAfterFailure = false) => {
            if (releaseInFlightRef.current) {
                return;
            }

            const showId = hold?.showId;

            if (!showId) {
                return;
            }

            releaseInFlightRef.current = true;
            setReleasing(true);

            try {
                const response = await fetch(`/api/holds/${holdId}`, {
                    method: "DELETE",
                    credentials: "same-origin",
                    cache: "no-store",
                });

                const result = (await response.json()) as ApiResponse<{
                    status: "RELEASED" | "EXPIRED";
                }>;

                if (!response.ok || !result.success || !result.data) {
                    throw new Error(
                        result.message ?? "Unable to release the hold.",
                    );
                }

                setHold((current) =>
                    current
                        ? {
                            ...current,
                            status: result.data!.status,
                            remainingSeconds: 0,
                        }
                        : current,
                );

                toast.success(
                    result.data.status === "EXPIRED"
                        ? "Hold expired and seats were released."
                        : "Seats released successfully.",
                );

                // Redirect only after the release operation succeeds.
                returnToSeatSelection(showId);
            } catch (caught) {
                toast.error(
                    caught instanceof Error
                        ? caught.message
                        : "Unable to release the hold.",
                );

                // An expired hold must not keep the customer
                // stuck on the checkout page if DELETE fails.
                if (redirectAfterFailure) {
                    returnToSeatSelection(showId);
                }
            } finally {
                releaseInFlightRef.current = false;
                setReleasing(false);
            }
        },
        [hold?.showId, holdId, router],
    );

    // Automatically release and redirect when the countdown reaches zero.
    useEffect(() => {
        if (!expired || automaticReleaseStarted.current) {
            return;
        }

        automaticReleaseStarted.current = true;

        void releaseHold(true);
    }, [expired, releaseHold]);

    async function confirmBooking() {
        if (confirmInFlightRef.current) {
            return;
        }

        // Document eligibility guard
        if (documentsLoading || !hasRequiredDocument) {
            toast.error(
                "Upload at least one profile photograph or identity card before confirming your booking.",
            );
            return;
        }

        if (!hold || hold.status !== "ACTIVE" || remainingSeconds <= 0) {
            toast.error("Your hold has expired. Select your seats again.");
            return;
        }

        if (selectedSeats.length !== hold.seatIds.length) {
            toast.error(
                "The held seat information is incomplete. Refresh the page.",
            );
            return;
        }

        confirmInFlightRef.current = true;
        setConfirming(true);

        try {
            // Revalidate the hold immediately before confirmation.
            // The POST endpoint performs authoritative validation again
            // under PostgreSQL locks.
            const holdCheckResponse = await fetch(
                `/api/holds/${holdId}`,
                {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store",
                },
            );

            const holdCheck =
                (await holdCheckResponse.json()) as ApiResponse<HoldData>;

            if (
                !holdCheckResponse.ok ||
                !holdCheck.success ||
                !holdCheck.data ||
                holdCheck.data.status !== "ACTIVE" ||
                holdCheck.data.remainingSeconds <= 0
            ) {
                throw new Error(
                    holdCheck.message ?? "Your hold is no longer active.",
                );
            }

            const idempotencyKey = getIdempotencyKey(holdId);

            const response = await fetch("/api/bookings", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": idempotencyKey,
                },
                cache: "no-store",
                body: JSON.stringify({
                    holdId,
                }),
            });

            const result =
                (await response.json()) as ApiResponse<BookingResponse>;

            if (!response.ok || !result.success || !result.data) {
                throw new Error(
                    result.message ?? "Booking confirmation failed.",
                );
            }

            router.push(
                `/bookings/confirmation/${result.data.id}`,
            );
        } catch (caught) {
            toast.error(
                caught instanceof Error
                    ? caught.message
                    : "Unable to confirm your booking. You can retry safely.",
            );

            // Preserve the idempotency key after network errors.
            // Retrying must reuse the same key.
            void loadCheckout();
        } finally {
            confirmInFlightRef.current = false;
            setConfirming(false);
        }
    }

    if (loading) {
        return (
            <main className="mx-auto max-w-5xl px-5 py-16">
                <p className="text-sm text-zinc-400">
                    Loading checkout...
                </p>
            </main>
        );
    }

    if (!hold || !seatMap) {
        return (
            <main className="mx-auto max-w-3xl px-5 py-16">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                    <h1 className="text-xl font-semibold text-white">
                        Unable to load checkout
                    </h1>

                    <p className="mt-3 text-sm text-red-400">
                        {error ?? "Hold information is unavailable."}
                    </p>

                    <Link
                        href="/movies"
                        className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black"
                    >
                        Browse movies
                    </Link>
                </div>
            </main>
        );
    }

    const show = seatMap.show;

    return (
        <main className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
            <Link
                href={`/shows/${hold.showId}/seats`}
                onClick={(event) => {
                    event.preventDefault();
                    void releaseHold();
                }}
            >
                ← Back to seat selection
            </Link>

            <div className="mt-7">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Checkout
                </p>

                <h1 className="mt-2 text-3xl font-bold text-white">
                    Review your booking
                </h1>
            </div>

            {error && (
                <div className="mt-6 rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-300">
                    {error}
                </div>
            )}

            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
                <div className="space-y-6">
                    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                        <h2 className="text-lg font-semibold text-white">
                            Movie and show
                        </h2>

                        <h3 className="mt-4 text-xl font-semibold">
                            {show.movie.title}
                        </h3>

                        <p className="mt-2 text-sm text-zinc-400">
                            {show.theatre.name}, {show.theatre.city}
                        </p>

                        <p className="mt-1 text-sm text-zinc-400">
                            Screen: {show.screen.name}
                        </p>

                        <p className="mt-3 text-sm text-zinc-300">
                            {formatIndiaDateTime(show.startTime)}
                            {" · Ends "}
                            {formatIndiaTime(show.endTime)}
                        </p>
                    </section>

                    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                        <h2 className="text-lg font-semibold text-white">
                            Selected seats
                        </h2>

                        <div className="mt-5 space-y-4">
                            {selectedSeats.map((seat) => (
                                <div
                                    key={seat.id}
                                    className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-4 last:border-0"
                                >
                                    <div>
                                        <p className="font-medium text-white">
                                            {seat.label}
                                        </p>

                                        <p className="mt-1 text-xs text-zinc-500">
                                            {seat.sectionName} · {seat.seatType}
                                        </p>
                                    </div>

                                    <p className="text-sm font-medium text-zinc-200">
                                        {formatINR(seat.price)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Booking documents */}
                    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                        <div className="mb-5">
                            <h2 className="text-lg font-semibold text-white">
                                Booking documents
                            </h2>

                            <p className="mt-2 text-sm leading-6 text-zinc-400">
                                Save at least one document before confirming this booking.
                                You can upload a profile photograph or an identity card.
                                Both are not required.
                            </p>
                        </div>

                        <DocumentUploader
                            required
                            onEligibilityChange={handleDocumentEligibilityChange}
                        />

                        <div className="mt-5">
                            <Link
                                href="/me"
                                className="text-sm font-medium text-zinc-300 underline underline-offset-4 transition hover:text-white"
                            >
                                Manage all documents in My Account
                            </Link>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                        <h2 className="text-lg font-semibold text-white">
                            Payment method
                        </h2>

                        <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-800 bg-emerald-950/20 p-4">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                            </span>

                            <div>
                                <p className="text-sm font-semibold text-white">
                                    Cash on Delivery
                                </p>

                                <p className="mt-1 text-xs text-zinc-400">
                                    Pay at the theatre. No online payment is required here.
                                </p>
                            </div>
                        </div>
                    </section>
                </div>

                <aside className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                    <h2 className="text-lg font-semibold text-white">
                        Booking summary
                    </h2>

                    <div className="mt-6 flex items-center justify-between text-sm">
                        <span className="text-zinc-400">
                            Tickets ({selectedSeats.length})
                        </span>

                        <span className="font-medium text-white">
                            {formatINR(estimatedTotal)}
                        </span>
                    </div>

                    <div className="my-5 border-t border-zinc-800" />

                    <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">
                            Estimated total
                        </span>

                        <span className="text-xl font-bold text-white">
                            {formatINR(estimatedTotal)}
                        </span>
                    </div>

                    <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                        <p className="text-center text-xs uppercase tracking-wider text-zinc-500">
                            Hold expires in
                        </p>

                        <p className="mt-2 text-center font-mono text-4xl font-bold tabular-nums text-white">
                            {active
                                ? formatCountdown(remainingSeconds)
                                : "00:00"}
                        </p>

                        <p className="mt-2 text-center text-xs text-zinc-500">
                            Five-minute temporary hold
                        </p>
                    </div>

                    {!active && (
                        <p className="mt-5 text-sm text-red-400">
                            This hold is no longer active. Returning to seat selection...
                        </p>
                    )}

                    {active && (
                        <button
                            type="button"
                            onClick={() => void confirmBooking()}
                            disabled={
                                confirming ||
                                releasing ||
                                remainingSeconds <= 0 ||
                                documentsLoading ||
                                !hasRequiredDocument
                            }
                            className="mt-6 w-full rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {confirming
                                ? "Confirming booking..."
                                : documentsLoading
                                  ? "Checking documents..."
                                  : !hasRequiredDocument
                                    ? "Upload a document to continue"
                                    : "Confirm booking"}
                        </button>
                    )}

                    {(active || expired) && (
                        <button
                            type="button"
                            onClick={() => void releaseHold()}
                            disabled={releasing || confirming}
                            className="mt-3 w-full rounded-xl border border-zinc-700 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                        >
                            {releasing ? "Releasing..." : "Release seats"}
                        </button>
                    )}

                    <p className="mt-4 text-center text-xs leading-5 text-zinc-500">
                        Your booking is confirmed only after the server successfully
                        completes the booking transaction.
                    </p>
                </aside>
            </div>
        </main>
    );
}