
import { AppError } from "@/lib/errors";

import {
  findPublicTheatreById,
  findPublicTheatres,
} from "./theatre.repository";

import type { TheatreListQuery } from "./theatre.validation";

export function listTheatres(query: TheatreListQuery) {
  return findPublicTheatres(query);
}

export async function getTheatreDetails(theatreId: string) {
  const theatre = await findPublicTheatreById(theatreId);

  if (!theatre) {
    throw new AppError(
      "Theatre not found or unavailable.",
      "THEATRE_NOT_FOUND",
      404,
    );
  }

  return theatre;
}
