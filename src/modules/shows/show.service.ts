import { AppError } from "@/lib/errors";

import {
  findPublicShowById,
  findPublicShows,
} from "./show.repository";
import type { ShowListQuery } from "./show.validation";

export function listShows(query: ShowListQuery) {
  return findPublicShows(query);
}

export async function getShowDetails(showId: string) {
  const show = await findPublicShowById(showId);

  if (!show) {
    throw new AppError(
      "Show not found or no longer available.",
      "SHOW_NOT_FOUND",
      404,
    );
  }

  return show;
}
