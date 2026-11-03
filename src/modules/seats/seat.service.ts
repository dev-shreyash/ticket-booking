import {
  findSeatMap,
  SeatMapIntegrityError,
} from "./seat.repository";

export class SeatMapNotFoundError extends Error {
  constructor() {
    super("Show not found or no longer available.");
    this.name = "SeatMapNotFoundError";
  }
}

export { SeatMapIntegrityError };

export async function getShowSeatMap(showId: string) {
  const result = await findSeatMap(showId);

  if (!result) {
    throw new SeatMapNotFoundError();
  }

  return result;
}