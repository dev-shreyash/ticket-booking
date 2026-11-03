import { HoldError } from "./hold.errors";
import { createHoldTransaction } from "./hold.repository";

import type { CreatedHold } from "./hold.types";

export type CreateHoldCommand = {
  userId: string;
  showId: string;
  seatIds: string[];
};

export async function createSeatHold(
  command: CreateHoldCommand,
): Promise<CreatedHold> {
  if (!command.userId) {
    throw new HoldError(
      "UNAUTHENTICATED",
      "Please sign in to reserve seats.",
    );
  }

  return createHoldTransaction({
    userId: command.userId,
    showId: command.showId,
    seatIds: command.seatIds,
  });
}