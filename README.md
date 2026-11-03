# Movie Ticket Booking System

A Next.js App Router application backed by PostgreSQL and Prisma. This repository currently contains the Phase 1 application shell and database foundation only. Authentication workflows, APIs, booking services and customer/admin UI are intentionally out of scope until later phases.

## Runtime and package versions

- Node.js 22.16+ (Next.js 16 requires Node.js 20.9+; Prisma ORM 7 requires Node.js 20.19+).
- npm 10+.
- PostgreSQL 15+ with permission to install the `btree_gist` extension.
- Next.js 16.4.3, React 19, TypeScript 5.9, Tailwind CSS 4.3.3.
- Prisma ORM / Client / PostgreSQL adapter 7.10.1.

Use the npm package versions pinned or ranged in `package.json` as the project baseline. Do not replace Prisma 7 with a Prisma 8 release candidate for this assignment.

## 1. Create a local PostgreSQL database

Create a database and a dedicated local development role. Example using the PostgreSQL shell as a database administrator:

```sql
CREATE ROLE movie_booking_user LOGIN PASSWORD 'replace-this-password';
CREATE DATABASE movie_booking OWNER movie_booking_user;
```

The initial migration creates the `btree_gist` extension. The migration role therefore needs permission to create that extension in the target database. If your PostgreSQL installation restricts extension creation, ask the database administrator to run:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

The database must be PostgreSQL. SQLite is not a substitute for the exclusion constraint, deferred constraint triggers, composite foreign keys or upcoming row-locking tests.

## 2. Configure environment variables

```bash
cp .env.example .env
```

Set `DATABASE_URL` to the local PostgreSQL connection string. URL-encode reserved characters in the username or password. Generate a new session secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Put the generated value in `SESSION_SECRET`. Keep `.env` out of version control. `NEXT_PUBLIC_*` variables are browser-visible; database credentials and session secrets must never use that prefix.

Example local URL:

```env
DATABASE_URL="postgresql://movie_booking_user:your-password@localhost:5432/movie_booking"
SESSION_SECRET="paste-a-random-secret-of-at-least-32-characters"
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

The Prisma CLI loads `.env` through `prisma.config.ts`; application and seed database initialization validate the server environment through `src/lib/env.ts`.

## 3. Install dependencies and generate Prisma Client

```bash
npm install
npm run db:generate
```

Prisma 7 uses the `prisma-client` generator and writes generated TypeScript to `src/generated/prisma`. Generated output is ignored by Git and must be regenerated after installing dependencies and whenever the schema changes.

## 4. Apply the initial migration and seed development data

```bash
npm run db:migrate
npm run db:seed
```

`db:migrate` runs `prisma migrate dev` and applies the checked-in migration. Do not use `prisma db push` as a substitute for migration history. For a clean database, Prisma may ask to create the database first; do so only against the intended local development database. If Prisma proposes resetting a database that contains data, stop and inspect before accepting.

The seed is repeatable and uses deterministic UUIDs/upserts. It creates three movies, two theatres, two screens, four seat sections, 44 physical seats, four scheduled shows, the corresponding per-show `ShowSeat` inventory, one admin and one customer. Existing show-seat state is not reset when the seed runs again.

Development identifiers:

| Role | Email |
|---|---|
| Admin | `admin@example.test` |
| Customer | `customer@example.test` |

There are no passwords and no OTP rows are seeded. Phase 2 will implement the demo OTP `123456` with a five-minute server-side expiry. These accounts are local development fixtures, not production identities.

## 5. Run the application

```bash
npm run dev
```

Open <http://localhost:3000>. The current page is only a foundation placeholder; no customer booking flow or APIs are implemented in Phase 1.

## 6. Useful checks and tools

```bash
npm run typecheck
npm run lint
npm run build
npm run db:studio
```

For deployment environments, apply already-reviewed migrations with:

```bash
npm run db:migrate:deploy
```

Do not run `migrate dev` against production.

## Database design and integrity decisions

### Screen-specific physical seats

`Seat` carries `screenId` as well as `sectionId`. A composite foreign key `(sectionId, screenId) -> SeatSection(id, screenId)` ensures a physical seat cannot claim a section from another screen. The redundant screen key is intentional: it allows PostgreSQL to enforce screen identity in composite relationships.

`ShowSeat` is the only availability record. A unique `(showId, seatId)` constraint guarantees at most one inventory row per physical seat per show. Composite foreign keys enforce that the inventory's show and seat belong to the same screen. No global availability flag exists on `Seat`.

### Show inventory completeness

A deferred PostgreSQL constraint trigger validates at transaction commit that each show has exactly one `ShowSeat` row for every physical seat on its screen. Therefore Phase 4 must create a show and all its inventory rows in the same transaction. Changes to a screen's physical seat count must similarly update the inventory of every affected show in the same transaction. A show cannot commit with an empty or partial inventory.

### Hold consistency

`ShowSeat` references a `SeatHold` through `(holdId, showId)`, so a hold from another show cannot claim an inventory row. A check constraint couples inventory status to hold/booking/expiry fields. Deferred triggers validate that ACTIVE holds own only matching HELD rows with the same expiry, CONVERTED holds own BOOKED rows for one booking and the hold's user, and EXPIRED/RELEASED holds own no HELD or BOOKED rows.

The database stores expiry timestamps; Phase 2/booking services must compare them with PostgreSQL time (`CURRENT_TIMESTAMP`/`clock_timestamp()` as appropriate) in transactional operations. A browser countdown is presentation only.

### Booking consistency and snapshots

`Booking` stores its show and screen, Decimal amount, payment status and an explicit `CASH_AT_THEATRE` payment method. A newly inserted booking defaults to `CONFIRMED` and `PENDING`. `BookingSeat` has immutable seat-label/section/price snapshots. Composite foreign keys tie each ticket to its booking, show, physical seat and the exact `ShowSeat` inventory row allocated to that booking. Unique `(showId, seatId)` prevents a physical seat from appearing in two ticket rows for the same show.

A deferred trigger verifies every booking has at least one ticket, its booked inventory rows match its ticket snapshots one-for-one, all seats came from one converted hold owned by the booking user, and `totalAmount` equals the sum of ticket prices before commit. Booking, hold, idempotency and ticket history cannot be deleted through ordinary SQL operations.

### Idempotency ownership

`IdempotencyRecord` is unique by `(userId, idempotencyKey)`. The request fingerprint is fixed-length SHA-256 hex. The booking association stores both `bookingId` and `bookingReference`; a custom composite FK verifies that the associated booking has the same user and reference. The pair must be either both null or both populated. The identity/fingerprint cannot be changed after insertion, and an associated record cannot be reassigned.

Phase 2 booking confirmation must still compare the existing fingerprint when a key is reused; a unique constraint alone cannot determine whether a retry has the same payload.

### Show scheduling

The migration installs `btree_gist` and defines a GiST exclusion constraint over `(screenId, [startTime,endTime))` for every non-cancelled show. Concurrent schedule writes are checked by PostgreSQL; adjacent shows are allowed, overlapping shows are rejected. `endTime > startTime` is a separate CHECK constraint.

### Deletion policy

Catalogue and booking relations use `RESTRICT`. Movies with show history should be archived (`Movie.status = ARCHIVED`) rather than deleted. Screens, seats, shows, bookings, holds and ticket snapshots are not cascade-deleted. Sessions cascade with a user; booking/hold/idempotency references restrict user deletion.

## Migration review notes

The migration contains custom PostgreSQL SQL that Prisma schema syntax does not express:

1. `btree_gist` screen-time exclusion constraint.
2. User identifier/normalization, date ordering, amount, seat-number and inventory-state CHECK constraints.
3. Composite same-show hold/booking foreign keys and a ticket-to-booked-inventory composite FK.
4. Composite idempotency booking-owner/reference FK.
5. Deferred triggers for show inventory completeness, hold/inventory consistency and booking ticket totals.
6. Triggers preventing deletion of historical holds/bookings/idempotency records and mutation/deletion of ticket snapshots.
7. A trigger protecting idempotency identity and fingerprint.

These are intentional migration-owned database guarantees. Do not regenerate this initial migration with `db push` or replace its SQL with an ORM-only approximation. Future schema changes should be made through new migrations and reviewed against these invariants.


### Pricing and cancellation boundary

`SeatSection.basePrice` is the server-side section price (INR, `Decimal(10,2)`). Phase 7 must read this value from PostgreSQL, compute totals using decimal arithmetic, and persist each applied ticket amount in `BookingSeat.price`; client-submitted prices are not authoritative. The Phase 1 enum includes `BookingStatus.CANCELLED`, but cancellation and seat resale are not implemented by this schema yet: the immutable ticket snapshot and exact allocation relationship intentionally preserve confirmed ticket history. Before a cancellation workflow is implemented, review a release-history design and migrate it explicitly; do not reset booked inventory directly.
