
import {
  MovieStatus,
  Prisma,
  SeatHoldStatus,
  ShowSeatStatus,
  ShowStatus,
} from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  HOLD_DURATION_SECONDS,
} from "./hold.constants";

import { HoldError } from "./hold.errors";

import type { CreatedHold } from "./hold.types";

type DatabaseClock = {
  databaseNow: Date;
  expiresAt: Date;
};

type ExpiredHoldRow = {
  id: string;
};

type ExpiredInventoryRow = {
  id: string;
  seatId: string;
  status: string;
};

type LockedInventoryRow = {
  id: string;
  seatId: string;
  status: string;
  holdId: string | null;
  expiresAt: Date | null;
};

type CreateHoldTransactionInput = {
  userId: string;
  showId: string;
  seatIds: string[];
};

/**
 * Creates a hold using a single PostgreSQL transaction.
 *
 * Concurrency strategy:
 * 1. Advisory transaction lock scoped to the show.
 * 2. Expired hold rows are locked and reclaimed.
 * 3. Requested ShowSeat rows are locked in ascending seat ID order.
 * 4. All requested seats are allocated atomically.
 *
 * The database clock determines the exact hold expiration.
 */
export async function createHoldTransaction(
  input: CreateHoldTransactionInput,
): Promise<CreatedHold> {
  const {
    userId,
    showId,
    seatIds,
  } = input;

  return prisma.$transaction(
    async (tx) => {
      // ------------------------------------------------------
      // 1. Acquire show-scoped advisory transaction lock.
      // All hold creation and release operations must use
      // the same key and seed for this show.
      // ------------------------------------------------------

      await tx.$queryRaw<Array<{ acquired: number }>>`
        SELECT 1::integer AS acquired
        FROM (
          SELECT pg_advisory_xact_lock(
            hashtextextended(${showId}, 5150)
          )
        ) AS show_lock
      `;

      // ------------------------------------------------------
      // 2. Read database time once.
      // Expiry is calculated by PostgreSQL itself.
      // ------------------------------------------------------

      const [clock] = await tx.$queryRaw<DatabaseClock[]>`
        SELECT
          timestamp_values.current_time AS "databaseNow",
          timestamp_values.current_time
            + INTERVAL '120 seconds' AS "expiresAt"
        FROM (
          SELECT clock_timestamp() AS current_time
        ) AS timestamp_values
      `;

      if (!clock) {
        throw new Error("Unable to obtain database time.");
      }

      const databaseNow = clock.databaseNow;
      const expiresAt = clock.expiresAt;

      // ------------------------------------------------------
      // 3. Validate the show.
      // Do not allow holds for inactive movies, cancelled
      // shows, completed shows or shows that have started.
      // ------------------------------------------------------

      const show = await tx.show.findUnique({
        where: {
          id: showId,
        },
        select: {
          id: true,
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

      if (!show) {
        throw new HoldError(
          "SHOW_NOT_FOUND",
          "Show not found.",
        );
      }

      if (
        show.status !== ShowStatus.SCHEDULED ||
        show.movie.status !== MovieStatus.ACTIVE ||
        show.startTime <= databaseNow ||
        show.endTime <= databaseNow
      ) {
        throw new HoldError(
          "SHOW_UNAVAILABLE",
          "This show is no longer available for seat selection.",
        );
      }

      // ------------------------------------------------------
      // 4. Lock all expired active holds for this show.
      //
      // This also handles expired holds owned by other users
      // even when they requested different seats.
      // ------------------------------------------------------

      const expiredHolds = await tx.$queryRaw<ExpiredHoldRow[]>`
        SELECT "id"
        FROM "SeatHold"
        WHERE "showId" = ${showId}
          AND "status" = 'ACTIVE'
          AND "expiresAt" <= ${databaseNow}
        ORDER BY "id" ASC
        FOR UPDATE
      `;

      const expiredHoldIds = expiredHolds.map(
        (hold) => hold.id,
      );

      // ------------------------------------------------------
      // 5. Lock and reclaim every allocation belonging to
      // expired holds. Do not reclaim only the requested
      // seats: a hold may contain several seats.
      // ------------------------------------------------------

      if (expiredHoldIds.length > 0) {
        const expiredInventory =
          await tx.$queryRaw<ExpiredInventoryRow[]>`
            SELECT
              "id",
              "seatId",
              "status"::text AS "status"
            FROM "ShowSeat"
            WHERE "showId" = ${showId}
              AND "holdId" IN (
                ${Prisma.join(expiredHoldIds)}
              )
            ORDER BY "seatId" ASC
            FOR UPDATE
          `;

        // A hold must own HELD allocations only.
        // Unexpected states indicate broken inventory integrity.
        if (
          expiredInventory.some(
            (row) => row.status !== ShowSeatStatus.HELD,
          )
        ) {
          throw new HoldError(
            "DATABASE_INTEGRITY_ERROR",
            "Seat allocation data is inconsistent. Please try again later.",
          );
        }

        const expiredInventoryIds =
          expiredInventory.map((row) => row.id);

        if (expiredInventoryIds.length > 0) {
          await tx.showSeat.updateMany({
            where: {
              id: {
                in: expiredInventoryIds,
              },
              showId,
              status: ShowSeatStatus.HELD,
            },
            data: {
              status: ShowSeatStatus.AVAILABLE,
              holdId: null,
              expiresAt: null,
              updatedAt: databaseNow,
            },
          });
        }

        await tx.seatHold.updateMany({
          where: {
            id: {
              in: expiredHoldIds,
            },
            showId,
            status: SeatHoldStatus.ACTIVE,
            expiresAt: {
              lte: databaseNow,
            },
          },
          data: {
            status: SeatHoldStatus.EXPIRED,
            updatedAt: databaseNow,
          },
        });
      }

      // ------------------------------------------------------
      // 6. Enforce one active hold per user per show.
      //
      // Expired holds have already been reclaimed and marked
      // EXPIRED. Never silently extend an existing hold.
      // ------------------------------------------------------

      const existingActiveHold = await tx.seatHold.findFirst({
        where: {
          userId,
          showId,
          status: SeatHoldStatus.ACTIVE,
          expiresAt: {
            gt: databaseNow,
          },
        },
        select: {
          id: true,
          expiresAt: true,
        },
      });

      if (existingActiveHold) {
        throw new HoldError(
          "ACTIVE_HOLD_EXISTS",
          "You already have an active hold for this show. Release it before selecting another set of seats.",
        );
      }

      // ------------------------------------------------------
      // 7. Verify every requested physical seat belongs to
      // the screen assigned to this show.
      // ------------------------------------------------------

      const physicalSeats = await tx.seat.findMany({
        where: {
          id: {
            in: seatIds,
          },
          screenId: show.screenId,
        },
        select: {
          id: true,
        },
      });

      if (physicalSeats.length !== seatIds.length) {
        throw new HoldError(
          "SEAT_NOT_FOUND",
          "One or more selected seats do not belong to this show's screen.",
        );
      }

      // ------------------------------------------------------
      // 8. Lock requested ShowSeat rows.
      //
      // Prisma.join parameterizes every requested ID.
      // ORDER BY seatId provides deterministic row-lock order.
      // ------------------------------------------------------

      const requestedInventory =
        await tx.$queryRaw<LockedInventoryRow[]>`
          SELECT
            "id",
            "seatId",
            "status"::text AS "status",
            "holdId",
            "expiresAt"
          FROM "ShowSeat"
          WHERE "showId" = ${showId}
            AND "seatId" IN (
              ${Prisma.join(seatIds)}
            )
          ORDER BY "seatId" ASC
          FOR UPDATE
        `;

      // Physical seats exist, therefore a missing ShowSeat
      // record is an inventory integrity error, not availability.
      if (requestedInventory.length !== seatIds.length) {
        throw new HoldError(
          "SEAT_INVENTORY_INCOMPLETE",
          "Seat inventory is incomplete for this show. Please contact support.",
        );
      }

      // ------------------------------------------------------
      // 9. Verify all requested allocations are AVAILABLE.
      // ------------------------------------------------------

      const unavailable = requestedInventory.some(
        (row) => {
          if (row.status === ShowSeatStatus.AVAILABLE) {
            // AVAILABLE rows must not retain a hold reference.
            return (
              row.holdId !== null ||
              row.expiresAt !== null
            );
          }

          if (row.status === ShowSeatStatus.BOOKED) {
            return true;
          }

          if (row.status === ShowSeatStatus.HELD) {
            // A valid expired ACTIVE hold should have been
            // reclaimed in step 5.
            //
            // A remaining expired allocation indicates that
            // database references or state are inconsistent.
            return true;
          }

          return true;
        },
      );

      if (unavailable) {
        throw new HoldError(
          "SEAT_UNAVAILABLE",
          "One or more selected seats are no longer available. Refresh the seat map and try again.",
        );
      }

      // ------------------------------------------------------
      // 10. Create a single hold for the entire seat selection.
      // ------------------------------------------------------

      const hold = await tx.seatHold.create({
        data: {
          userId,
          showId,
          status: SeatHoldStatus.ACTIVE,
          expiresAt,
          createdAt: databaseNow,
          updatedAt: databaseNow,
        },
        select: {
          id: true,
          expiresAt: true,
        },
      });

      // ------------------------------------------------------
      // 11. Atomically allocate all requested ShowSeat rows.
      // Update count is checked before transaction commit.
      // ------------------------------------------------------

      const allocationResult = await tx.showSeat.updateMany({
        where: {
          showId,
          id: {
            in: requestedInventory.map(
              (row) => row.id,
            ),
          },
          status: ShowSeatStatus.AVAILABLE,
          holdId: null,
          expiresAt: null,
        },
        data: {
          status: ShowSeatStatus.HELD,
          holdId: hold.id,
          expiresAt,
          updatedAt: databaseNow,
        },
      });

      if (allocationResult.count !== seatIds.length) {
        throw new HoldError(
          "SEAT_UNAVAILABLE",
          "Seat availability changed during the request. No seats were reserved.",
        );
      }

      // ------------------------------------------------------
      // 12. Return the committed hold information.
      // ------------------------------------------------------

      return {
        holdId: hold.id,
        showId,
        seatIds,
        expiresAt: hold.expiresAt.toISOString(),
        durationSeconds: HOLD_DURATION_SECONDS,
      };
    },
    {
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
}
