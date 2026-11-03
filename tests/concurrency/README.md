# PostgreSQL concurrency test contract

These tests are intentionally not mocked. They must run against a disposable PostgreSQL database with the same migration set as development. SQLite and mocked Prisma calls do not reproduce PostgreSQL row locks, GiST exclusion constraints, deferred constraint triggers or transaction-abort behaviour.

When the hold and booking services exist (Phase 6/7), the integration harness must use two independent database connections and coordinate them with barriers so the requests overlap in time.

Required scenarios:

1. **Same-seat race:** two authenticated users request the same `(showId, seatId)` at the same time. Exactly one request commits a hold; the other receives a conflict. The inventory row has one owner/hold.
2. **All-or-nothing request:** request seats C3 and C4 where C3 is available and C4 is held/booked. The transaction must roll back; C3 remains available and no partial hold exists.
3. **Expired hold reclamation:** create a hold, set its expiry into the past using PostgreSQL time in a test fixture, then acquire the seat from another user without running a cleanup worker. The old hold must become EXPIRED in the same transaction that releases/reassigns its inventory.
4. **Expired confirmation:** a confirmation after hold expiry must fail and must not create a Booking or BookingSeat row.
5. **Lost response retry:** commit booking confirmation, discard the simulated response, and retry with the same user/key/fingerprint. The original booking is returned and only one booking exists.
6. **Key payload mismatch:** reuse `(userId, idempotencyKey)` with another fingerprint. Reject it; never return the old booking as if it matched the changed request.
7. **Hold ownership:** a second user cannot convert or release another user's hold.
8. **Schedule race:** concurrent inserts/updates of overlapping intervals on one screen result in at most one committed scheduled interval. PostgreSQL's `Show_screen_time_no_overlap` exclusion constraint is the final arbiter.
9. **Cross-screen integrity:** attempts to attach a screen A seat to a screen B show fail through composite foreign keys.
10. **Rollback:** force an error after some booking writes and verify no Booking, BookingSeat, inventory state change or completed idempotency association survives.

For row locking, Phase 6 should lock inventory rows in deterministic `seatId` order, inside one transaction, using parameterized SQL such as `SELECT ... FROM "ShowSeat" WHERE ... ORDER BY "seatId" FOR UPDATE`. Revalidate all seat states and expiry timestamps after acquiring the locks. The database unique constraints and deferred triggers remain active even if service code has a defect.
