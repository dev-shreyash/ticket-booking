ALTER TABLE "ShowSeat"
ADD CONSTRAINT "ShowSeat_holdId_showId_same_show_fkey"
FOREIGN KEY ("holdId", "showId")
REFERENCES "SeatHold" ("id", "showId")
ON DELETE RESTRICT
ON UPDATE CASCADE;