-- Read-only database audit. Run after migration and seed:
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/integration/schema-audit.sql

\echo '1. Required application tables'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'User', 'OtpVerification', 'Session', 'Movie', 'Theatre', 'Screen',
    'SeatSection', 'Seat', 'Show', 'ShowSeat', 'SeatHold', 'Booking',
    'BookingSeat', 'IdempotencyRecord'
  )
ORDER BY table_name;

\echo '2. Critical unique, foreign-key, exclusion and check constraints'
SELECT c.conrelid::regclass AS table_name, c.conname, c.contype
FROM pg_constraint c
WHERE c.connamespace = 'public'::regnamespace
  AND c.conrelid::regclass::text IN (
    '"Show"', '"ShowSeat"', '"Seat"', '"SeatSection"',
    '"SeatHold"', '"Booking"', '"BookingSeat"', '"IdempotencyRecord"', '"User"'
  )
ORDER BY table_name, c.contype, c.conname;

\echo '3. Shows with missing or extra inventory rows (expected: zero rows)'
SELECT
  sh."id" AS show_id,
  sh."screenId" AS screen_id,
  (SELECT count(*) FROM "Seat" s WHERE s."screenId" = sh."screenId") AS expected_seats,
  (SELECT count(*) FROM "ShowSeat" ss WHERE ss."showId" = sh."id") AS actual_inventory
FROM "Show" sh
WHERE
  (SELECT count(*) FROM "Seat" s WHERE s."screenId" = sh."screenId") = 0
  OR
  (SELECT count(*) FROM "ShowSeat" ss WHERE ss."showId" = sh."id") <>
  (SELECT count(*) FROM "Seat" s WHERE s."screenId" = sh."screenId");

\echo '4. Duplicate show-seat inventory (expected: zero rows)'
SELECT "showId", "seatId", count(*)
FROM "ShowSeat"
GROUP BY "showId", "seatId"
HAVING count(*) > 1;

\echo '5. Booking totals not equal to immutable ticket snapshots (expected: zero rows)'
SELECT
  b."id",
  b."totalAmount",
  COALESCE(sum(bs."price"), 0) AS ticket_total,
  count(bs."id") AS ticket_count
FROM "Booking" b
LEFT JOIN "BookingSeat" bs ON bs."bookingId" = b."id"
GROUP BY b."id", b."totalAmount"
HAVING count(bs."id") = 0 OR b."totalAmount" <> COALESCE(sum(bs."price"), 0);

\echo '6. Invalid show intervals (expected: zero rows)'
SELECT "id", "startTime", "endTime"
FROM "Show"
WHERE "endTime" <= "startTime";

\echo '7. Active holds with mismatched inventory (expected: zero rows)'
SELECT h."id", h."status", h."expiresAt", ss."id" AS inventory_id,
       ss."status" AS inventory_status, ss."expiresAt" AS inventory_expiry
FROM "SeatHold" h
JOIN "ShowSeat" ss ON ss."holdId" = h."id"
WHERE h."status" = 'ACTIVE'
  AND (ss."status" <> 'HELD' OR ss."expiresAt" IS DISTINCT FROM h."expiresAt");
