import { prisma } from "@/lib/prisma";

import { HoldError } from "./hold.errors";

type HoldStatusRow = {
  holdId: string;
  showId: string;
  userId: string;
  status: string;
  expiresAt: Date;
  remainingSeconds: number;
  seatIds: string[];
};

export type HoldStatusResult = {
  holdId: string;
  showId: string;
  status: string;
  expiresAt: string;
  remainingSeconds: number;
  seatCount: number;
  seatIds: string[];
};

export async function getHoldStatus(
  holdId: string,
  userId: string,
  isAdmin: boolean,
): Promise<HoldStatusResult> {
  const rows = await prisma.$queryRaw<HoldStatusRow[]>`
    WITH db_clock AS (
      SELECT clock_timestamp() AS "databaseNow"
    )
    SELECT
      h."id"::text AS "holdId",
      h."showId"::text AS "showId",
      h."userId"::text AS "userId",

      CASE
        WHEN
          h."status" = 'ACTIVE'::"SeatHoldStatus"
          AND h."expiresAt" <= c."databaseNow"
        THEN 'EXPIRED'
        ELSE h."status"::text
      END AS "status",

      h."expiresAt" AS "expiresAt",

      CASE
        WHEN
          h."status" = 'ACTIVE'::"SeatHoldStatus"
          AND h."expiresAt" > c."databaseNow"
        THEN GREATEST(
          0,
          CEIL(
            EXTRACT(EPOCH FROM (h."expiresAt" - c."databaseNow"))
          )
        )::integer
        ELSE 0
      END AS "remainingSeconds",

      COALESCE(
        ARRAY(
          SELECT ss."seatId"::text
          FROM "ShowSeat" ss
          WHERE
            ss."holdId" = h."id"
            AND ss."showId" = h."showId"
          ORDER BY ss."seatId" ASC
        ),
        ARRAY[]::text[]
      ) AS "seatIds"

    FROM "SeatHold" h
    CROSS JOIN db_clock c
    WHERE h."id" = ${holdId}::uuid
  `;

  const hold = rows[0];

  if (!hold) {
    throw new HoldError("HOLD_NOT_FOUND", "Hold was not found.");
  }

  if (!isAdmin && hold.userId !== userId) {
    throw new HoldError(
      "HOLD_FORBIDDEN",
      "You are not authorized to view this hold.",
    );
  }

  return {
    holdId: hold.holdId,
    showId: hold.showId,
    status: hold.status,
    expiresAt: hold.expiresAt.toISOString(),
    remainingSeconds: hold.remainingSeconds,
    seatCount: hold.seatIds.length,
    seatIds: hold.seatIds,
  };
}