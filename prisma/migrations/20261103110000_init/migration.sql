-- Phase 1: Movie Ticket Booking System
-- PostgreSQL is the source of truth for relational integrity.

CREATE EXTENSION IF NOT EXISTS "btree_gist";

CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN');
CREATE TYPE "MovieStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "SeatCategory" AS ENUM ('STANDARD', 'PREMIUM', 'RECLINER');
CREATE TYPE "SeatType" AS ENUM ('STANDARD', 'PREMIUM', 'RECLINER');
CREATE TYPE "ShowStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "ShowSeatStatus" AS ENUM ('AVAILABLE', 'HELD', 'BOOKED');
CREATE TYPE "SeatHoldStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'EXPIRED', 'RELEASED');
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH_AT_THEATRE');

CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT,
    "email" VARCHAR(320),
    "phone" VARCHAR(16),
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "User_email_key" UNIQUE ("email"),
    CONSTRAINT "User_phone_key" UNIQUE ("phone"),
    CONSTRAINT "User_has_identifier_check" CHECK (
      ("email" IS NOT NULL AND btrim("email") <> '') OR
      ("phone" IS NOT NULL AND btrim("phone") <> '')
    ),
    CONSTRAINT "User_email_normalized_check" CHECK (
      "email" IS NULL OR ("email" = lower(btrim("email")) AND "email" <> '')
    ),
    CONSTRAINT "User_phone_e164_check" CHECK (
      "phone" IS NULL OR "phone" ~ '^\+[1-9][0-9]{7,14}$'
    )
);

CREATE TABLE "OtpVerification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identifier" VARCHAR(320) NOT NULL,
    "codeHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OtpVerification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OtpVerification_attempt_count_check" CHECK ("attemptCount" >= 0),
    CONSTRAINT "OtpVerification_expiry_check" CHECK ("expiresAt" > "createdAt"),
    CONSTRAINT "OtpVerification_identifier_normalized_check" CHECK (
      "identifier" = lower(btrim("identifier")) AND "identifier" <> ''
    ),
    CONSTRAINT "OtpVerification_code_hash_check" CHECK (btrim("codeHash") <> '')
);

CREATE TABLE "Session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Session_tokenHash_key" UNIQUE ("tokenHash"),
    CONSTRAINT "Session_expiry_check" CHECK ("expiresAt" > "createdAt"),
    CONSTRAINT "Session_token_hash_check" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "Movie" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "language" VARCHAR(80) NOT NULL,
    "genre" VARCHAR(120) NOT NULL,
    "certification" VARCHAR(20) NOT NULL,
    "posterUrl" TEXT,
    "releaseDate" DATE NOT NULL,
    "status" "MovieStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Movie_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Movie_duration_check" CHECK ("duration" > 0)
);

CREATE TABLE "Theatre" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "address" TEXT NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Theatre_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Screen" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "theatreId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Screen_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Screen_theatreId_name_key" UNIQUE ("theatreId", "name")
);

CREATE TABLE "SeatSection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "screenId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" "SeatCategory" NOT NULL,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeatSection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SeatSection_screenId_name_key" UNIQUE ("screenId", "name"),
    CONSTRAINT "SeatSection_id_screenId_key" UNIQUE ("id", "screenId"),
    CONSTRAINT "SeatSection_base_price_check" CHECK ("basePrice" > 0)
);

CREATE TABLE "Seat" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "screenId" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "rowLabel" VARCHAR(10) NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "seatType" "SeatType" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Seat_sectionId_rowLabel_seatNumber_key" UNIQUE ("sectionId", "rowLabel", "seatNumber"),
    CONSTRAINT "Seat_id_screenId_key" UNIQUE ("id", "screenId"),
    CONSTRAINT "Seat_number_positive_check" CHECK ("seatNumber" > 0),
    CONSTRAINT "Seat_row_label_check" CHECK (btrim("rowLabel") <> '')
);

CREATE TABLE "Show" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "movieId" UUID NOT NULL,
    "screenId" UUID NOT NULL,
    "startTime" TIMESTAMPTZ(3) NOT NULL,
    "endTime" TIMESTAMPTZ(3) NOT NULL,
    "status" "ShowStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Show_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Show_id_screenId_key" UNIQUE ("id", "screenId"),
    CONSTRAINT "Show_time_order_check" CHECK ("endTime" > "startTime")
);

CREATE TABLE "SeatHold" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "showId" UUID NOT NULL,
    "status" "SeatHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeatHold_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SeatHold_id_showId_key" UNIQUE ("id", "showId"),
    CONSTRAINT "SeatHold_expiry_check" CHECK ("expiresAt" > "createdAt")
);

CREATE TABLE "Booking" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bookingReference" VARCHAR(40) NOT NULL,
    "userId" UUID NOT NULL,
    "showId" UUID NOT NULL,
    "screenId" UUID NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH_AT_THEATRE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Booking_bookingReference_key" UNIQUE ("bookingReference"),
    CONSTRAINT "Booking_id_showId_key" UNIQUE ("id", "showId"),
    CONSTRAINT "Booking_id_userId_bookingReference_key" UNIQUE ("id", "userId", "bookingReference"),
    CONSTRAINT "Booking_total_amount_check" CHECK ("totalAmount" >= 0)
);

CREATE TABLE "ShowSeat" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "showId" UUID NOT NULL,
    "screenId" UUID NOT NULL,
    "seatId" UUID NOT NULL,
    "status" "ShowSeatStatus" NOT NULL DEFAULT 'AVAILABLE',
    "holdId" UUID,
    "bookingId" UUID,
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShowSeat_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShowSeat_showId_seatId_key" UNIQUE ("showId", "seatId"),
    CONSTRAINT "ShowSeat_bookingId_showId_seatId_key" UNIQUE ("bookingId", "showId", "seatId"),
    CONSTRAINT "ShowSeat_allocation_state_check" CHECK (
      ("status" = 'AVAILABLE' AND "bookingId" IS NULL AND "expiresAt" IS NULL) OR
      ("status" = 'HELD' AND "holdId" IS NOT NULL AND "bookingId" IS NULL AND "expiresAt" IS NOT NULL) OR
      ("status" = 'BOOKED' AND "holdId" IS NOT NULL AND "bookingId" IS NOT NULL AND "expiresAt" IS NULL)
    )
);

CREATE TABLE "BookingSeat" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bookingId" UUID NOT NULL,
    "showId" UUID NOT NULL,
    "screenId" UUID NOT NULL,
    "seatId" UUID NOT NULL,
    "seatLabelSnapshot" VARCHAR(40) NOT NULL,
    "sectionSnapshot" VARCHAR(100) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingSeat_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BookingSeat_showId_seatId_key" UNIQUE ("showId", "seatId"),
    CONSTRAINT "BookingSeat_bookingId_showId_seatId_key" UNIQUE ("bookingId", "showId", "seatId"),
    CONSTRAINT "BookingSeat_price_check" CHECK ("price" >= 0),
    CONSTRAINT "BookingSeat_snapshot_check" CHECK (
      btrim("seatLabelSnapshot") <> '' AND btrim("sectionSnapshot") <> ''
    )
);

CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "requestFingerprint" VARCHAR(64) NOT NULL,
    "bookingId" UUID,
    "bookingReference" VARCHAR(40),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IdempotencyRecord_bookingId_key" UNIQUE ("bookingId"),
    CONSTRAINT "IdempotencyRecord_userId_idempotencyKey_key" UNIQUE ("userId", "idempotencyKey"),
    CONSTRAINT "IdempotencyRecord_booking_pair_check" CHECK (
      ("bookingId" IS NULL AND "bookingReference" IS NULL) OR
      ("bookingId" IS NOT NULL AND "bookingReference" IS NOT NULL)
    ),
    CONSTRAINT "IdempotencyRecord_fingerprint_check" CHECK (
      "requestFingerprint" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "IdempotencyRecord_key_check" CHECK (btrim("idempotencyKey") <> '')
);

-- Foreign keys use RESTRICT for catalogue/history data. Only sessions cascade with user deletion.
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Screen" ADD CONSTRAINT "Screen_theatreId_fkey"
  FOREIGN KEY ("theatreId") REFERENCES "Theatre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SeatSection" ADD CONSTRAINT "SeatSection_screenId_fkey"
  FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_sectionId_screenId_fkey"
  FOREIGN KEY ("sectionId", "screenId") REFERENCES "SeatSection"("id", "screenId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Show" ADD CONSTRAINT "Show_movieId_fkey"
  FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Show" ADD CONSTRAINT "Show_screenId_fkey"
  FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SeatHold" ADD CONSTRAINT "SeatHold_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SeatHold" ADD CONSTRAINT "SeatHold_showId_fkey"
  FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_showId_screenId_fkey"
  FOREIGN KEY ("showId", "screenId") REFERENCES "Show"("id", "screenId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShowSeat" ADD CONSTRAINT "ShowSeat_showId_screenId_fkey"
  FOREIGN KEY ("showId", "screenId") REFERENCES "Show"("id", "screenId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShowSeat" ADD CONSTRAINT "ShowSeat_seatId_screenId_fkey"
  FOREIGN KEY ("seatId", "screenId") REFERENCES "Seat"("id", "screenId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShowSeat" ADD CONSTRAINT "ShowSeat_holdId_fkey"
  FOREIGN KEY ("holdId") REFERENCES "SeatHold"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShowSeat" ADD CONSTRAINT "ShowSeat_holdId_showId_same_show_fkey"
  FOREIGN KEY ("holdId", "showId") REFERENCES "SeatHold"("id", "showId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShowSeat" ADD CONSTRAINT "ShowSeat_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShowSeat" ADD CONSTRAINT "ShowSeat_bookingId_showId_same_show_fkey"
  FOREIGN KEY ("bookingId", "showId") REFERENCES "Booking"("id", "showId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_bookingId_showId_fkey"
  FOREIGN KEY ("bookingId", "showId") REFERENCES "Booking"("id", "showId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_showId_screenId_fkey"
  FOREIGN KEY ("showId", "screenId") REFERENCES "Show"("id", "screenId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_seatId_screenId_fkey"
  FOREIGN KEY ("seatId", "screenId") REFERENCES "Seat"("id", "screenId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_showId_seatId_fkey"
  FOREIGN KEY ("showId", "seatId") REFERENCES "ShowSeat"("showId", "seatId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_bookingId_showId_seatId_match_inventory_fkey"
  FOREIGN KEY ("bookingId", "showId", "seatId") REFERENCES "ShowSeat"("bookingId", "showId", "seatId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Extra composite FK: the idempotency row's user and reference must identify the same booking.
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_booking_owner_reference_fkey"
  FOREIGN KEY ("bookingId", "userId", "bookingReference")
  REFERENCES "Booking"("id", "userId", "bookingReference")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Query-path indexes. Unique indexes above also support their relation lookups.
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "OtpVerification_identifier_createdAt_idx" ON "OtpVerification"("identifier", "createdAt");
CREATE INDEX "OtpVerification_identifier_expiresAt_idx" ON "OtpVerification"("identifier", "expiresAt");
CREATE INDEX "OtpVerification_expiresAt_idx" ON "OtpVerification"("expiresAt");
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "Movie_status_releaseDate_idx" ON "Movie"("status", "releaseDate");
CREATE INDEX "Movie_title_idx" ON "Movie"("title");
CREATE INDEX "Theatre_city_idx" ON "Theatre"("city");
CREATE INDEX "Screen_theatreId_idx" ON "Screen"("theatreId");
CREATE INDEX "SeatSection_screenId_idx" ON "SeatSection"("screenId");
CREATE INDEX "Seat_screenId_rowLabel_idx" ON "Seat"("screenId", "rowLabel");
CREATE INDEX "Seat_sectionId_idx" ON "Seat"("sectionId");
CREATE INDEX "Show_movieId_startTime_status_idx" ON "Show"("movieId", "startTime", "status");
CREATE INDEX "Show_screenId_startTime_status_idx" ON "Show"("screenId", "startTime", "status");
CREATE INDEX "Show_status_startTime_idx" ON "Show"("status", "startTime");
CREATE INDEX "SeatHold_userId_status_idx" ON "SeatHold"("userId", "status");
CREATE INDEX "SeatHold_showId_status_idx" ON "SeatHold"("showId", "status");
CREATE INDEX "SeatHold_status_expiresAt_idx" ON "SeatHold"("status", "expiresAt");
CREATE INDEX "SeatHold_expiresAt_idx" ON "SeatHold"("expiresAt");
CREATE INDEX "Booking_userId_createdAt_idx" ON "Booking"("userId", "createdAt");
CREATE INDEX "Booking_showId_status_idx" ON "Booking"("showId", "status");
CREATE INDEX "Booking_paymentStatus_createdAt_idx" ON "Booking"("paymentStatus", "createdAt");
CREATE INDEX "ShowSeat_showId_status_idx" ON "ShowSeat"("showId", "status");
CREATE INDEX "ShowSeat_holdId_idx" ON "ShowSeat"("holdId");
CREATE INDEX "ShowSeat_bookingId_idx" ON "ShowSeat"("bookingId");
CREATE INDEX "ShowSeat_expiresAt_idx" ON "ShowSeat"("expiresAt");
CREATE INDEX "ShowSeat_screenId_idx" ON "ShowSeat"("screenId");
CREATE INDEX "ShowSeat_seatId_screenId_idx" ON "ShowSeat"("seatId", "screenId");
CREATE INDEX "BookingSeat_bookingId_idx" ON "BookingSeat"("bookingId");
CREATE INDEX "BookingSeat_showId_idx" ON "BookingSeat"("showId");
CREATE INDEX "BookingSeat_seatId_screenId_idx" ON "BookingSeat"("seatId", "screenId");
CREATE INDEX "IdempotencyRecord_userId_createdAt_idx" ON "IdempotencyRecord"("userId", "createdAt");

-- Prevent overlapping shows on one screen. [start, end) permits back-to-back shows.
-- CANCELLED schedules no longer reserve screen time; COMPLETED schedules remain historical blockers.
ALTER TABLE "Show"
  ADD CONSTRAINT "Show_screen_time_no_overlap"
  EXCLUDE USING gist (
    "screenId" WITH =,
    tstzrange("startTime", "endTime", '[)') WITH &&
  ) WHERE ("status" <> 'CANCELLED');

-- A show must have exactly one inventory row for every physical seat on its screen.
CREATE OR REPLACE FUNCTION assert_show_inventory_complete(p_show_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_screen_id UUID;
  v_expected BIGINT;
  v_actual BIGINT;
BEGIN
  SELECT "screenId" INTO v_screen_id FROM "Show" WHERE "id" = p_show_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_expected FROM "Seat" WHERE "screenId" = v_screen_id;
  SELECT count(*) INTO v_actual FROM "ShowSeat" WHERE "showId" = p_show_id;

  IF v_expected = 0 OR v_actual <> v_expected THEN
    RAISE EXCEPTION 'Show % inventory incomplete: expected % rows, found %',
      p_show_id, v_expected, v_actual
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trg_assert_show_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_show_id UUID;
  v_screen_id UUID;
  v_record RECORD;
BEGIN
  IF TG_TABLE_NAME = 'Show' THEN
    IF TG_OP <> 'INSERT' THEN
      PERFORM assert_show_inventory_complete(OLD."id");
    END IF;
    IF TG_OP <> 'DELETE' THEN
      PERFORM assert_show_inventory_complete(NEW."id");
    END IF;
  ELSIF TG_TABLE_NAME = 'ShowSeat' THEN
    IF TG_OP <> 'INSERT' THEN
      PERFORM assert_show_inventory_complete(OLD."showId");
    END IF;
    IF TG_OP <> 'DELETE' THEN
      PERFORM assert_show_inventory_complete(NEW."showId");
    END IF;
  ELSIF TG_TABLE_NAME = 'Seat' THEN
    IF TG_OP <> 'INSERT' THEN
      FOR v_record IN SELECT "id" FROM "Show" WHERE "screenId" = OLD."screenId" LOOP
        PERFORM assert_show_inventory_complete(v_record."id");
      END LOOP;
    END IF;
    IF TG_OP <> 'DELETE' THEN
      FOR v_record IN SELECT "id" FROM "Show" WHERE "screenId" = NEW."screenId" LOOP
        PERFORM assert_show_inventory_complete(v_record."id");
      END LOOP;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "Show_inventory_complete_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "Show"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trg_assert_show_inventory();

CREATE CONSTRAINT TRIGGER "ShowSeat_inventory_complete_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "ShowSeat"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trg_assert_show_inventory();

CREATE CONSTRAINT TRIGGER "Seat_inventory_complete_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "Seat"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trg_assert_show_inventory();

-- Hold and inventory states must agree at transaction commit.
CREATE OR REPLACE FUNCTION assert_hold_inventory_consistent(p_hold_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_status "SeatHoldStatus";
  v_expires_at TIMESTAMPTZ(3);
  v_user_id UUID;
  v_show_id UUID;
  v_count BIGINT;
BEGIN
  SELECT "status", "expiresAt", "userId", "showId"
    INTO v_status, v_expires_at, v_user_id, v_show_id
  FROM "SeatHold" WHERE "id" = p_hold_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_count FROM "ShowSeat" WHERE "holdId" = p_hold_id;

  IF v_status IN ('ACTIVE', 'CONVERTED') AND v_count = 0 THEN
    RAISE EXCEPTION 'Hold % cannot be % without inventory rows', p_hold_id, v_status
      USING ERRCODE = '23514';
  END IF;

  IF v_status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM "ShowSeat"
    WHERE "holdId" = p_hold_id
      AND ("status" <> 'HELD' OR "expiresAt" IS DISTINCT FROM v_expires_at)
  ) THEN
    RAISE EXCEPTION 'Active hold % has inconsistent seat allocations', p_hold_id
      USING ERRCODE = '23514';
  END IF;

  IF v_status = 'CONVERTED' AND (
    EXISTS (SELECT 1 FROM "ShowSeat" WHERE "holdId" = p_hold_id AND ("status" <> 'BOOKED' OR "bookingId" IS NULL))
    OR (SELECT count(DISTINCT "bookingId") FROM "ShowSeat" WHERE "holdId" = p_hold_id) <> 1
    OR EXISTS (
      SELECT 1 FROM "ShowSeat" ss
      JOIN "Booking" b ON b."id" = ss."bookingId" AND b."showId" = ss."showId"
      WHERE ss."holdId" = p_hold_id AND b."userId" <> v_user_id
    )
  ) THEN
    RAISE EXCEPTION 'Converted hold % must map to one booking for its owner', p_hold_id
      USING ERRCODE = '23514';
  END IF;

  IF v_status IN ('EXPIRED', 'RELEASED') AND EXISTS (
    SELECT 1 FROM "ShowSeat"
    WHERE "holdId" = p_hold_id AND "status" IN ('HELD', 'BOOKED')
  ) THEN
    RAISE EXCEPTION 'Expired or released hold % still owns an allocated seat', p_hold_id
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trg_assert_hold_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'SeatHold' THEN
    IF TG_OP <> 'DELETE' THEN
      PERFORM assert_hold_inventory_consistent(NEW."id");
    END IF;
  ELSE
    IF TG_OP <> 'INSERT' AND OLD."holdId" IS NOT NULL THEN
      PERFORM assert_hold_inventory_consistent(OLD."holdId");
    END IF;
    IF TG_OP <> 'DELETE' AND NEW."holdId" IS NOT NULL THEN
      PERFORM assert_hold_inventory_consistent(NEW."holdId");
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "SeatHold_inventory_consistency_trigger"
AFTER INSERT OR UPDATE ON "SeatHold"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trg_assert_hold_inventory();

CREATE CONSTRAINT TRIGGER "ShowSeat_hold_consistency_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "ShowSeat"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trg_assert_hold_inventory();

-- Every confirmed booking must have at least one ticket and its total must equal ticket prices.
CREATE OR REPLACE FUNCTION assert_booking_ticket_total(p_booking_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_total DECIMAL(10,2);
  v_ticket_total DECIMAL(10,2);
  v_ticket_count BIGINT;
  v_inventory_count BIGINT;
  v_booking_user_id UUID;
  v_booking_show_id UUID;
  v_hold_id UUID;
  v_hold_status "SeatHoldStatus";
  v_hold_user_id UUID;
  v_hold_show_id UUID;
BEGIN
  SELECT "totalAmount", "userId", "showId"
    INTO v_total, v_booking_user_id, v_booking_show_id
  FROM "Booking" WHERE "id" = p_booking_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT count(*), COALESCE(sum("price"), 0)
    INTO v_ticket_count, v_ticket_total
  FROM "BookingSeat" WHERE "bookingId" = p_booking_id;
  SELECT count(*) INTO v_inventory_count
  FROM "ShowSeat" WHERE "bookingId" = p_booking_id;

  IF v_ticket_count = 0
     OR v_total <> v_ticket_total
     OR v_inventory_count <> v_ticket_count THEN
    RAISE EXCEPTION 'Booking % ticket/inventory/total mismatch (tickets %, inventory %, total %, ticket total %)',
      p_booking_id, v_ticket_count, v_inventory_count, v_total, v_ticket_total
      USING ERRCODE = '23514';
  END IF;

  SELECT ss."holdId", h."status", h."userId", h."showId"
    INTO v_hold_id, v_hold_status, v_hold_user_id, v_hold_show_id
  FROM "ShowSeat" ss
  JOIN "SeatHold" h ON h."id" = ss."holdId" AND h."showId" = ss."showId"
  WHERE ss."bookingId" = p_booking_id
  ORDER BY ss."seatId"
  LIMIT 1;

  IF v_hold_id IS NULL OR v_hold_status <> 'CONVERTED'
     OR v_hold_user_id <> v_booking_user_id
     OR v_hold_show_id <> v_booking_show_id
     OR (SELECT count(DISTINCT "holdId") FROM "ShowSeat" WHERE "bookingId" = p_booking_id) <> 1 THEN
    RAISE EXCEPTION 'Booking % must be backed by one converted hold owned by the booking user', p_booking_id
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trg_assert_booking_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'Booking' THEN
    IF TG_OP <> 'DELETE' THEN
      PERFORM assert_booking_ticket_total(NEW."id");
    END IF;
  ELSE
    IF TG_OP <> 'INSERT' THEN
      PERFORM assert_booking_ticket_total(OLD."bookingId");
    END IF;
    IF TG_OP <> 'DELETE' THEN
      PERFORM assert_booking_ticket_total(NEW."bookingId");
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "Booking_ticket_total_trigger"
AFTER INSERT OR UPDATE ON "Booking"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trg_assert_booking_total();

CREATE CONSTRAINT TRIGGER "BookingSeat_ticket_total_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "BookingSeat"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trg_assert_booking_total();

CREATE CONSTRAINT TRIGGER "ShowSeat_booking_total_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "ShowSeat"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trg_assert_booking_total();

-- Preserve ticket and idempotency history; a ticket snapshot is immutable after insertion.
CREATE OR REPLACE FUNCTION reject_historical_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Historical % records cannot be deleted', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "SeatHold_no_delete_trigger"
BEFORE DELETE ON "SeatHold"
FOR EACH ROW EXECUTE FUNCTION reject_historical_delete();
CREATE TRIGGER "Booking_no_delete_trigger"
BEFORE DELETE ON "Booking"
FOR EACH ROW EXECUTE FUNCTION reject_historical_delete();
CREATE TRIGGER "IdempotencyRecord_no_delete_trigger"
BEFORE DELETE ON "IdempotencyRecord"
FOR EACH ROW EXECUTE FUNCTION reject_historical_delete();
CREATE TRIGGER "BookingSeat_immutable_trigger"
BEFORE UPDATE OR DELETE ON "BookingSeat"
FOR EACH ROW EXECUTE FUNCTION reject_historical_delete();

-- Idempotency identity is immutable; the initially-null booking association may be set once.
CREATE OR REPLACE FUNCTION protect_idempotency_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."userId" IS DISTINCT FROM OLD."userId"
     OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
     OR NEW."requestFingerprint" IS DISTINCT FROM OLD."requestFingerprint" THEN
    RAISE EXCEPTION 'Idempotency identity and request fingerprint are immutable'
      USING ERRCODE = '55000';
  END IF;
  IF OLD."bookingId" IS NOT NULL AND (
    NEW."bookingId" IS DISTINCT FROM OLD."bookingId" OR
    NEW."bookingReference" IS DISTINCT FROM OLD."bookingReference"
  ) THEN
    RAISE EXCEPTION 'An idempotency record cannot be reassigned to another booking'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "IdempotencyRecord_identity_immutable_trigger"
BEFORE UPDATE ON "IdempotencyRecord"
FOR EACH ROW EXECUTE FUNCTION protect_idempotency_identity();
