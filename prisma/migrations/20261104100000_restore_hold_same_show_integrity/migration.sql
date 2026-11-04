-- Restore the same-show integrity constraint accidentally removed by
-- 20261104055313_add_user_documents.

ALTER TABLE "ShowSeat"
ADD CONSTRAINT "ShowSeat_holdId_showId_same_show_fkey"
FOREIGN KEY ("holdId", "showId")
REFERENCES "SeatHold" ("id", "showId")
ON DELETE RESTRICT
ON UPDATE CASCADE
NOT VALID;

-- Validate existing records after adding the constraint.
ALTER TABLE "ShowSeat"
VALIDATE CONSTRAINT "ShowSeat_holdId_showId_same_show_fkey";