export type CreatedHold = {
  holdId: string;
  showId: string;
  seatIds: string[];
  expiresAt: string;
  durationSeconds: number;
};

export type ReleasedHold = {
  holdId: string;
  showId: string;
  status: "RELEASED";
  releasedSeats: number;
};