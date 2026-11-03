import {
  SeatHoldStatus,
  ShowSeatStatus,
} from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import { HoldError } from "./hold.errors";

type ReleaseHoldInput = {
  holdId: string;
  userId: string;
  isAdmin: boolean;
};

type LockedHold = {
  id: string;
  showId: string;
  userId: string;
  status: string;
  expiresAt: Date;
};

type LockedShowSeat = {
  id: string;
  seatId: string;
  status: string;
};

export type ReleasedHoldResult = {
  holdId: string;
  showId: string;
  status: "RELEASED" | "EXPIRED";
  releasedSeatCount: number;
  expiresAt: Date;
};

export async function releaseHoldTransaction(
  input: ReleaseHoldInput,
): Promise<ReleasedHoldResult> {
  // Read the show ID first so release can acquire the same show-scoped
  // advisory lock used by hold creation.
  const initialHold = await prisma.seatHold.findUnique({
    where: {
      id: input.holdId,
    },
    select: {
      showId: true,
    },
  });

  if (!initialHold) {
    throw new HoldError("HOLD_NOT_FOUND", "Hold was not found.");
  }

  return prisma.$transaction(
    async (tx) => {
      const showId = initialHold.showId;

      // This must match the lock used by createHoldTransaction.
      await tx.$queryRaw<Array<{ acquired: number }>>`
        SELECT 1::integer AS acquired
        FROM (
          SELECT pg_advisory_xact_lock(
            hashtextextended(${showId}, 5150)
          )
        ) AS show_lock
      `;

      // Lock the hold after acquiring the show lock.
      const holds = await tx.$queryRaw<LockedHold[]>`
        SELECT
          "id"::text AS "id",
          "showId"::text AS "showId",
          "userId"::text AS "userId",
          "status"::text AS "status",
          "expiresAt" AS "expiresAt"
        FROM "SeatHold"
        WHERE "id" = ${input.holdId}::uuid
        FOR UPDATE
      `;

      const hold = holds[0];

      if (!hold) {
        throw new HoldError("HOLD_NOT_FOUND", "Hold was not found.");
      }

      if (hold.showId !== showId) {
        throw new HoldError(
          "DATABASE_INTEGRITY_ERROR",
          "The hold's show relationship changed unexpectedly.",
        );
      }

      if (!input.isAdmin && hold.userId !== input.userId) {
        throw new HoldError(
          "HOLD_FORBIDDEN",
          "You are not authorized to release this hold.",
        );
      }

      // Lock all seats belonging to this hold in deterministic order.
      const seats = await tx.$queryRaw<LockedShowSeat[]>`
        SELECT
          "id"::text AS "id",
          "seatId"::text AS "seatId",
          "status"::text AS "status"
        FROM "ShowSeat"
        WHERE
          "showId" = ${showId}::uuid
          AND "holdId" = ${input.holdId}::uuid
        ORDER BY "seatId" ASC
        FOR UPDATE
      `;

      // Repeated DELETE requests are safe for already released/expired holds.
      if (
        hold.status === SeatHoldStatus.RELEASED ||
        hold.status === SeatHoldStatus.EXPIRED
      ) {
        if (seats.length > 0) {
          throw new HoldError(
            "DATABASE_INTEGRITY_ERROR",
            "A completed hold still has allocated inventory.",
          );
        }

        return {
          holdId: hold.id,
          showId: hold.showId,
          status: hold.status,
          releasedSeatCount: 0,
          expiresAt: hold.expiresAt,
        };
      }

      if (hold.status !== SeatHoldStatus.ACTIVE) {
        throw new HoldError(
          "HOLD_NOT_ACTIVE",
          "This hold can no longer be released.",
        );
      }

      if (seats.length === 0) {
        throw new HoldError(
          "DATABASE_INTEGRITY_ERROR",
          "An active hold has no allocated seats.",
        );
      }

      if (
        seats.some((seat) => seat.status !== ShowSeatStatus.HELD)
      ) {
        throw new HoldError(
          "DATABASE_INTEGRITY_ERROR",
          "The hold contains inventory that is not in HELD status.",
        );
      }

      // Use PostgreSQL time, not the application server's clock.
      const clockRows = await tx.$queryRaw<Array<{ databaseNow: Date }>>`
        SELECT clock_timestamp() AS "databaseNow"
      `;

      const databaseNow = clockRows[0].databaseNow;
      const expired = hold.expiresAt.getTime() <= databaseNow.getTime();

      const nextStatus = expired
        ? SeatHoldStatus.EXPIRED
        : SeatHoldStatus.RELEASED;

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

      if (inventoryUpdate.count !== seats.length) {
        throw new HoldError(
          "DATABASE_INTEGRITY_ERROR",
          "Not all held seats could be released. The transaction was rolled back.",
        );
      }

      const holdUpdate = await tx.seatHold.updateMany({
        where: {
          id: input.holdId,
          status: SeatHoldStatus.ACTIVE,
        },
        data: {
          status: nextStatus,
        },
      });

      if (holdUpdate.count !== 1) {
        throw new HoldError(
          "DATABASE_INTEGRITY_ERROR",
          "The hold status could not be updated. The transaction was rolled back.",
        );
      }

      return {
        holdId: hold.id,
        showId: hold.showId,
        status: expired ? "EXPIRED" : "RELEASED",
        releasedSeatCount: inventoryUpdate.count,
        expiresAt: hold.expiresAt,
      };
    },
    {
      maxWait: 5000,
      timeout: 15000,
    },
  );
}