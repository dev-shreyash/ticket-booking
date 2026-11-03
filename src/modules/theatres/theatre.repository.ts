
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import type { TheatreListQuery } from "./theatre.validation";

export async function findPublicTheatres(query: TheatreListQuery) {
  const where: Prisma.TheatreWhereInput = {
    screens: { some: {} },
    ...(query.city
      ? {
          city: {
            equals: query.city,
            mode: "insensitive",
          },
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    prisma.theatre.findMany({
      where,
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        _count: {
          select: { screens: true },
        },
      },
      orderBy: [
        { city: "asc" },
        { name: "asc" },
        { id: "asc" },
      ],
      skip,
      take: query.limit,
    }),
    prisma.theatre.count({ where }),
  ]);

  return {
    data: rows.map(({ _count, ...theatre }) => ({
      ...theatre,
      screenCount: _count.screens,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function findPublicTheatreById(theatreId: string) {
  const theatre = await prisma.theatre.findFirst({
    where: {
      id: theatreId,
      screens: { some: {} },
    },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      screens: {
        select: {
          id: true,
          name: true,
        },
        orderBy: [
          { name: "asc" },
          { id: "asc" },
        ],
      },
    },
  });

  if (!theatre) {
    return null;
  }

  return {
    ...theatre,
    screenCount: theatre.screens.length,
  };
}
