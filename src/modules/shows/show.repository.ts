import {
  MovieStatus,
  ShowStatus,
  type Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import type { ShowListQuery } from "./show.validation";

const publicShowSelect = {
  id: true,
  startTime: true,
  endTime: true,
  movie: {
    select: {
      id: true,
      title: true,
      language: true,
      duration: true,
      certification: true,
      posterUrl: true,
    },
  },
  screen: {
    select: {
      id: true,
      name: true,
      theatre: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
        },
      },
    },
  },
} satisfies Prisma.ShowSelect;

/**
 * Converts a YYYY-MM-DD calendar date in Asia/Kolkata into a UTC range.
 * IST is UTC+05:30 throughout the year; India does not observe DST.
 * The interval is inclusive at start and exclusive at end.
 */
export function getIndiaCalendarDayRange(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const istOffsetMinutes = 330;
  const startUtcMs =
    Date.UTC(year, month - 1, day, 0, 0, 0, 0) -
    istOffsetMinutes * 60_000;

  return {
    startUtc: new Date(startUtcMs),
    endUtc: new Date(startUtcMs + 24 * 60 * 60 * 1000),
  };
}

async function getDatabaseNow(): Promise<Date> {
  const [row] = await prisma.$queryRaw<Array<{ databaseNow: Date }>>`
    SELECT clock_timestamp() AS "databaseNow"
  `;

  if (!row) {
    throw new Error("Unable to read database time.");
  }

  return row.databaseNow;
}

export async function findPublicShows(query: ShowListQuery) {
  const databaseNow = await getDatabaseNow();
  const dateRange = query.date
    ? getIndiaCalendarDayRange(query.date)
    : null;

  const screenWhere: Prisma.ScreenWhereInput = {};

  if (query.theatreId) {
    screenWhere.theatreId = query.theatreId;
  }

  if (query.city) {
    screenWhere.theatre = {
      is: {
        city: {
          equals: query.city,
          mode: "insensitive",
        },
      },
    };
  }

  const where: Prisma.ShowWhereInput = {
    status: ShowStatus.SCHEDULED,
    // Discovery is for future shows. Database time is authoritative.
    startTime: {
      gt: databaseNow,
      ...(dateRange
        ? {
            gte: dateRange.startUtc,
            lt: dateRange.endUtc,
          }
        : {}),
    },
    movie: {
      is: { status: MovieStatus.ACTIVE },
    },
    ...(query.movieId ? { movieId: query.movieId } : {}),
    ...(Object.keys(screenWhere).length > 0
      ? { screen: { is: screenWhere } }
      : {}),
  };

  return prisma.show.findMany({
    where,
    select: publicShowSelect,
    orderBy: [
      { startTime: "asc" },
      { id: "asc" },
    ],
  });
}

export async function findPublicShowById(showId: string) {
  const databaseNow = await getDatabaseNow();

  return prisma.show.findFirst({
    where: {
      id: showId,
      status: ShowStatus.SCHEDULED,
      startTime: { gt: databaseNow },
      movie: {
        is: { status: MovieStatus.ACTIVE },
      },
    },
    select: publicShowSelect,
  });
}
