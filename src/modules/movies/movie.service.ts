import { AppError } from "@/lib/errors";

import {
  findPublicMovieById,
  findPublicMovies,
} from "./movie.repository";
import type { MovieListQuery } from "./movie.validation";

export function listMovies(query: MovieListQuery) {
  return findPublicMovies(query);
}

export async function getMovieDetails(movieId: string) {
  const movie = await findPublicMovieById(movieId);

  if (!movie) {
    throw new AppError(
      "Movie not found.",
      "MOVIE_NOT_FOUND",
      404,
    );
  }

  return movie;
}
