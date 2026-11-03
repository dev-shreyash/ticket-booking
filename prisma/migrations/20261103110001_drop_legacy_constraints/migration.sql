-- DropForeignKey
ALTER TABLE "BookingSeat" DROP CONSTRAINT "BookingSeat_bookingId_showId_seatId_match_inventory_fkey";

-- DropForeignKey
ALTER TABLE "IdempotencyRecord" DROP CONSTRAINT "IdempotencyRecord_booking_owner_reference_fkey";

-- DropForeignKey
ALTER TABLE "ShowSeat" DROP CONSTRAINT "ShowSeat_bookingId_showId_same_show_fkey";

-- DropForeignKey
ALTER TABLE "ShowSeat" DROP CONSTRAINT "ShowSeat_holdId_showId_same_show_fkey";
