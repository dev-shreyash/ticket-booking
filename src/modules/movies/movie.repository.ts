import {
  MovieStatus,
  type Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import type { MovieListQuery } from "./movie.validation";

const publicMovieSelect = {
  id: true,
  title: true,
  description: true,
  duration: true,
  language: true,
  genre: true,
  certification: true,
  posterUrl: true,
  releaseDate: true,
} as const;

export async function findPublicMovies(query: MovieListQuery) {
  const where: Prisma.MovieWhereInput = {
    status: MovieStatus.ACTIVE,
    ...(query.search
      ? {
          title: {
            contains: query.search,
            mode: "insensitive",
          },
        }
      : {}),
    ...(query.language
      ? {
          language: {
            equals: query.language,
            mode: "insensitive",
          },
        }
      : {}),
    ...(query.genre
      ? {
          genre: {
            contains: query.genre,
            mode: "insensitive",
          },
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [data, total] = await Promise.all([
    prisma.movie.findMany({
      where,
      select: publicMovieSelect,
      orderBy: [
        { releaseDate: "desc" },
        { title: "asc" },
        { id: "asc" },
      ],
      skip,
      take: query.limit,
    }),
    prisma.movie.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function findPublicMovieById(movieId: string) {
  return prisma.movie.findFirst({
    where: {
      id: movieId,
      status: MovieStatus.ACTIVE,
    },
    select: publicMovieSelect,
  });
}
