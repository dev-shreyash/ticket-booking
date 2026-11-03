import { createHash, randomInt } from "node:crypto";

import {
    BookingStatus,
    MovieStatus,
    PaymentMethod,
    PaymentStatus,
    Prisma,
    SeatHoldStatus,
    ShowSeatStatus,
    ShowStatus,
} from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { BookingError } from "./booking.errors";

import type {
    BookingConfirmationInput,
    BookingConfirmationResponse,
} from "./booking.types";

type ExistingBooking = {
    id: string;
    bookingReference: string;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    totalAmount: Prisma.Decimal;
    createdAt: Date;
};

type LockedHold = {
    id: string;
    userId: string;
    showId: string;
    status: string;
    expiresAt: Date;
};

type LockedAllocation = {
    id: string;
    seatId: string;
    screenId: string;
    status: string;
    holdId: string | null;
    bookingId: string | null;
    expiresAt: Date | null;
    seatLabel: string | null;
    sectionName: string | null;
    seatType: string | null;
    price: Prisma.Decimal | string | number | null;
};

type TransactionResult =
    | {
        kind: "created" | "existing";
        booking: ExistingBooking;
    }
    | {
        kind: "expired";
    };

function createRequestFingerprint(holdId: string): string {
    return createHash("sha256")
        .update(JSON.stringify({ holdId }))
        .digest("hex");
}

function generateBookingReference(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let result = "";

    for (let index = 0; index < 8; index += 1) {
        result += alphabet[randomInt(alphabet.length)];
    }

    return `MTB-${result}`;
}

function isUniqueConstraintError(error: unknown): boolean {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
    );
}

async function findIdempotentBooking(
    db: typeof prisma | Prisma.TransactionClient,
    userId: string,
    idempotencyKey: string,
    fingerprint: string,
): Promise<ExistingBooking | null> {
    const record = await db.idempotencyRecord.findFirst({
        where: {
            userId,
            idempotencyKey,
        },
    });

    if (!record) {
        return null;
    }

    if (record.requestFingerprint !== fingerprint) {
        throw new BookingError(
            "IDEMPOTENCY_KEY_REUSED",
            "This idempotency key has already been used with a different booking request.",
        );
    }

    if (!record.bookingId) {
        throw new BookingError(
            "BOOKING_INTEGRITY_ERROR",
            "An incomplete idempotency record was found.",
        );
    }

    const booking = await db.booking.findFirst({
        where: {
            id: record.bookingId,
            userId,
        },
        select: {
            id: true,
            bookingReference: true,
            status: true,
            paymentMethod: true,
            paymentStatus: true,
            totalAmount: true,
            createdAt: true,
        },
    });

    if (!booking) {
        throw new BookingError(
            "BOOKING_INTEGRITY_ERROR",
            "The original booking associated with this idempotency key was not found.",
        );
    }

    return booking;
}

function serializeConfirmation(
    booking: ExistingBooking,
    replayed: boolean,
): BookingConfirmationResponse {
    return {
        booking: {
            id: booking.id,
            bookingReference: booking.bookingReference,
            status: booking.status,
            paymentMethod: booking.paymentMethod,
            paymentStatus: booking.paymentStatus,
            totalAmount: booking.totalAmount.toFixed(2),
            createdAt: booking.createdAt.toISOString(),
        },
        replayed,
    };
}

export async function confirmBookingTransaction(
    input: BookingConfirmationInput,
): Promise<BookingConfirmationResponse> {
    const fingerprint = createRequestFingerprint(input.holdId);

    // Return an already committed booking before inspecting the hold.
    const previousBooking = await findIdempotentBooking(
        prisma,
        input.userId,
        input.idempotencyKey,
        fingerprint,
    );

    if (previousBooking) {
        return serializeConfirmation(previousBooking, true);
    }

    // Read showId so we can acquire the same Phase 5 advisory lock.
    // Ownership and status are checked again inside the transaction.
    const initialHold = await prisma.seatHold.findUnique({
        where: {
            id: input.holdId,
        },
        select: {
            showId: true,
        },
    });

    if (!initialHold) {
        throw new BookingError(
            "HOLD_NOT_FOUND",
            "The requested seat hold was not found.",
        );
    }

    try {
        const transactionResult = await prisma.$transaction(
            async (tx): Promise<TransactionResult> => {
                const showId = initialHold.showId;

                // Same advisory lock key as Phase 5 hold creation and release.
                await tx.$queryRaw<Array<{ acquired: number }>>`
          SELECT 1::integer AS acquired
          FROM (
            SELECT pg_advisory_xact_lock(
              hashtextextended(${showId}, 5150)
            )
          ) AS show_lock
        `;

                // Handles a previously committed request.
                const existing = await findIdempotentBooking(
                    tx,
                    input.userId,
                    input.idempotencyKey,
                    fingerprint,
                );

                if (existing) {
                    return {
                        kind: "existing",
                        booking: existing,
                    };
                }

                // Lock the hold row.
                const holdRows = await tx.$queryRaw<LockedHold[]>`
          SELECT
            "id"::text AS "id",
            "userId"::text AS "userId",
            "showId"::text AS "showId",
            "status"::text AS "status",
            "expiresAt" AS "expiresAt"
          FROM "SeatHold"
          WHERE "id" = ${input.holdId}::uuid
          FOR UPDATE
        `;

                const hold = holdRows[0];

                if (!hold) {
                    throw new BookingError(
                        "HOLD_NOT_FOUND",
                        "The seat hold no longer exists.",
                    );
                }

                if (hold.showId !== showId) {
                    throw new BookingError(
                        "BOOKING_INTEGRITY_ERROR",
                        "The hold show relationship changed unexpectedly.",
                    );
                }

                if (hold.userId !== input.userId) {
                    throw new BookingError(
                        "HOLD_FORBIDDEN",
                        "You are not authorized to confirm this hold.",
                    );
                }

                if (hold.status !== SeatHoldStatus.ACTIVE) {
                    throw new BookingError(
                        "HOLD_NOT_ACTIVE",
                        "This hold is no longer active and cannot be converted into a booking.",
                    );
                }

                /*
                 * Read the actual database structure:
                 *
                 * Seat:
                 *   rowLabel, seatNumber, sectionId, screenId
                 *
                 * SeatSection:
                 *   name, category
                 *
                 * ShowSectionPrice:
                 *   showId, screenId, sectionId, price
                 *
                 * Lock only ShowSeat rows, in ascending seatId order.
                 */
                const allocations = await tx.$queryRaw<LockedAllocation[]>`
          SELECT
            ss."id"::text AS "id",
            ss."seatId"::text AS "seatId",
            ss."screenId"::text AS "screenId",
            ss."status"::text AS "status",
            ss."holdId"::text AS "holdId",
            ss."bookingId"::text AS "bookingId",
            ss."expiresAt" AS "expiresAt",

            concat(
              seat."rowLabel",
              seat."seatNumber"::text
            ) AS "seatLabel",

            section."name" AS "sectionName",
            section."category"::text AS "seatType",
            price."price" AS "price"

          FROM "ShowSeat" ss

          LEFT JOIN "Seat" seat
            ON seat."id" = ss."seatId"
            AND seat."screenId" = ss."screenId"

          LEFT JOIN "SeatSection" section
            ON section."id" = seat."sectionId"
            AND section."screenId" = seat."screenId"

          LEFT JOIN "ShowSectionPrice" price
            ON price."showId" = ss."showId"
            AND price."screenId" = ss."screenId"
            AND price."sectionId" = seat."sectionId"

          WHERE
            ss."showId" = ${showId}::uuid
            AND ss."holdId" = ${input.holdId}::uuid

          ORDER BY ss."seatId" ASC

          FOR UPDATE OF ss
        `;

                if (allocations.length === 0) {
                    throw new BookingError(
                        "BOOKING_INTEGRITY_ERROR",
                        "The active hold has no allocated seats.",
                    );
                }

                for (const allocation of allocations) {
                    if (
                        allocation.status !== ShowSeatStatus.HELD ||
                        allocation.holdId !== input.holdId ||
                        allocation.bookingId !== null
                    ) {
                        throw new BookingError(
                            "BOOKING_INTEGRITY_ERROR",
                            "The hold contains an inconsistent seat allocation.",
                        );
                    }
                }

                // Obtain PostgreSQL time after all required locks.
                const clockRows = await tx.$queryRaw<
                    Array<{ databaseNow: Date }>
                >`
          SELECT clock_timestamp() AS "databaseNow"
        `;

                const databaseNow = clockRows[0].databaseNow;

                // An expired hold is reclaimed atomically.
                // No Booking or IdempotencyRecord is created in this branch.
                if (hold.expiresAt.getTime() <= databaseNow.getTime()) {
                    const inventoryUpdate = await tx.showSeat.updateMany({
                        where: {
                            showId,
                            holdId: input.holdId,
                            status: ShowSeatStatus.HELD,
                        },
                        data: {
                            status: ShowSeatStatus.AVAILABLE,
                            holdId: null,
                            expiresAt: null,
                        },
                    });

                    if (inventoryUpdate.count !== allocations.length) {
                        throw new BookingError(
                            "BOOKING_INTEGRITY_ERROR",
                            "Expired inventory could not be reclaimed atomically.",
                        );
                    }

                    await tx.seatHold.update({
                        where: {
                            id: input.holdId,
                        },
                        data: {
                            status: SeatHoldStatus.EXPIRED,
                        },
                    });

                    return {
                        kind: "expired",
                    };
                }

                // Validate show eligibility using database time.
                const show = await tx.show.findUnique({
                    where: {
                        id: showId,
                    },
                    select: {
                        screenId: true,
                        status: true,
                        startTime: true,
                        endTime: true,
                        movie: {
                            select: {
                                status: true,
                            },
                        },
                    },
                });

                if (
                    !show ||
                    show.status !== ShowStatus.SCHEDULED ||
                    show.movie.status !== MovieStatus.ACTIVE ||
                    show.startTime.getTime() <= databaseNow.getTime() ||
                    show.endTime.getTime() <= databaseNow.getTime()
                ) {
                    throw new BookingError(
                        "SHOW_UNAVAILABLE",
                        "This show is no longer eligible for booking.",
                    );
                }

                // Validate screen, expiry consistency and historical data.
                for (const allocation of allocations) {
                    if (
                        allocation.screenId !== show.screenId ||
                        !allocation.expiresAt ||
                        allocation.expiresAt.getTime() !==
                        hold.expiresAt.getTime()
                    ) {
                        throw new BookingError(
                            "BOOKING_INTEGRITY_ERROR",
                            "The held seat inventory does not match the hold expiry or screen.",
                        );
                    }

                    if (
                        !allocation.seatLabel ||
                        !allocation.sectionName ||
                        !allocation.seatType ||
                        allocation.price === null
                    ) {
                        throw new BookingError(
                            "BOOKING_INTEGRITY_ERROR",
                            "Seat, section or authoritative pricing information is missing.",
                        );
                    }
                }

                // Calculate all amounts using Decimal arithmetic.
                let totalAmount = new Prisma.Decimal(0);

                const bookingSeatData = allocations.map((allocation) => {
                    const price = new Prisma.Decimal(
                        String(allocation.price),
                    );

                    if (price.lessThan(0)) {
                        throw new BookingError(
                            "BOOKING_INTEGRITY_ERROR",
                            "An invalid seat price was found.",
                        );
                    }

                    totalAmount = totalAmount.add(price);

                    return {
                        showId,
                        screenId: show.screenId,
                        seatId: allocation.seatId,
                        seatLabelSnapshot: allocation.seatLabel!,
                        sectionSnapshot: allocation.sectionName!,
                        seatTypeSnapshot: allocation.seatType!,
                        price,
                    };
                });

                // This record and its final booking association are committed
                // in the same transaction.
                const idempotencyRecord =
                    await tx.idempotencyRecord.create({
                        data: {
                            userId: input.userId,
                            idempotencyKey: input.idempotencyKey,
                            requestFingerprint: fingerprint,
                        },
                    });

                const booking = await tx.booking.create({
                    data: {
                        bookingReference: generateBookingReference(),
                        userId: input.userId,
                        showId,
                        screenId: show.screenId,
                        status: BookingStatus.CONFIRMED,
                        totalAmount,
                        paymentMethod: PaymentMethod.CASH_AT_THEATRE,
                        paymentStatus: PaymentStatus.PENDING,
                    },
                    select: {
                        id: true,
                        bookingReference: true,
                        status: true,
                        paymentMethod: true,
                        paymentStatus: true,
                        totalAmount: true,
                        createdAt: true,
                    },
                });

                await tx.bookingSeat.createMany({
                    data: bookingSeatData.map((seat) => ({
                        bookingId: booking.id,
                        ...seat,
                    })),
                });

                // Convert every allocated seat while preserving its original hold reference.
                // The database CHECK constraint requires holdId for BOOKED allocations.
                const inventoryUpdate = await tx.showSeat.updateMany({
                    where: {
                        showId,
                        holdId: input.holdId,
                        status: ShowSeatStatus.HELD,
                    },
                    data: {
                        status: ShowSeatStatus.BOOKED,
                        bookingId: booking.id,
                        expiresAt: null,
                    },
                });
                if (inventoryUpdate.count !== allocations.length) {
                    throw new BookingError(
                        "BOOKING_INTEGRITY_ERROR",
                        "Not all held seats could be converted. The transaction will be rolled back.",
                    );
                }

                const holdUpdate = await tx.seatHold.updateMany({
                    where: {
                        id: input.holdId,
                        userId: input.userId,
                        status: SeatHoldStatus.ACTIVE,
                    },
                    data: {
                        status: SeatHoldStatus.CONVERTED,
                    },
                });

                if (holdUpdate.count !== 1) {
                    throw new BookingError(
                        "BOOKING_INTEGRITY_ERROR",
                        "The hold could not be converted. The transaction will be rolled back.",
                    );
                }

                await tx.idempotencyRecord.update({
                    where: {
                        id: idempotencyRecord.id,
                    },
                    data: {
                        bookingId: booking.id,
                        bookingReference: booking.bookingReference,
                    },
                });

                return {
                    kind: "created",
                    booking,
                };
            },
            {
                maxWait: 5000,
                timeout: 20000,
            },
        );

        if (transactionResult.kind === "expired") {
            throw new BookingError(
                "HOLD_EXPIRED",
                "The hold expired before confirmation. The seats have been released.",
            );
        }

        return serializeConfirmation(
            transactionResult.booking,
            transactionResult.kind === "existing",
        );
    } catch (error) {
        // A concurrent request may have won the unique idempotency key.
        if (isUniqueConstraintError(error)) {
            const existing = await findIdempotentBooking(
                prisma,
                input.userId,
                input.idempotencyKey,
                fingerprint,
            );

            if (existing) {
                return serializeConfirmation(existing, true);
            }

            throw new BookingError(
                "BOOKING_CONFLICT",
                "A booking uniqueness conflict occurred. Retry using the same idempotency key.",
            );
        }

        throw error;
    }
}
