
-- ============================================================
-- Phase 5: Enforce same-show hold/inventory relationship
-- ============================================================
--
-- A ShowSeat allocation must never reference a SeatHold
-- belonging to a different show.
--
-- Existing simple FK on holdId is retained because it is
-- represented by the existing Prisma relation.
--
-- The composite FK adds the missing same-show guarantee.
-- NULL holdId values are allowed for AVAILABLE/BOOKED seats.
-- ============================================================

ALTER TABLE "ShowSeat"
ADD CONSTRAINT "ShowSeat_holdId_showId_same_show_fkey"
FOREIGN KEY ("holdId", "showId")
REFERENCES "SeatHold" ("id", "showId")
ON DELETE RESTRICT
ON UPDATE CASCADE;
