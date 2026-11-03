
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  MovieStatus,
  PrismaClient,
  SeatCategory,
  SeatType,
  ShowSeatStatus,
  ShowStatus,
  UserRole,
} from "../src/generated/prisma/client";

import { getServerEnvironment } from "../src/lib/env";

const { DATABASE_URL } = getServerEnvironment();

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: DATABASE_URL,
  }),
});

function deterministicUuid(value: number): string {
  return `00000000-0000-4000-8000-${value
    .toString(16)
    .padStart(12, "0")}`;
}

function utcDateInDays(
  daysFromToday: number,
  hour: number,
  minute = 0,
): Date {
  const date = new Date();

  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  date.setUTCHours(hour, minute, 0, 0);

  return date;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

async function seedUsers() {
  await prisma.user.upsert({
    where: {
      id: deterministicUuid(1),
    },
    create: {
      id: deterministicUuid(1),
      name: "Development Admin",
      email: "admin@example.test",
      role: UserRole.ADMIN,
    },
    update: {},
  });

  await prisma.user.upsert({
    where: {
      id: deterministicUuid(2),
    },
    create: {
      id: deterministicUuid(2),
      name: "Development Customer",
      email: "customer@example.test",
      role: UserRole.CUSTOMER,
    },
    update: {},
  });
}

async function seedCatalogue() {
  const movies = [
    {
      id: deterministicUuid(101),
      title: "Orbit: Beyond the Stars",
      description:
        "A science-fiction expedition discovers an unexpected signal beyond the solar system.",
      duration: 142,
      language: "English",
      genre: "Science Fiction / Adventure",
      certification: "UA 13+",
      releaseDate: new Date("2026-10-15T00:00:00.000Z"),
    },
    {
      id: deterministicUuid(102),
      title: "The Last Monsoon",
      description:
        "A family returns to its coastal hometown as an extraordinary monsoon changes their lives.",
      duration: 128,
      language: "Hindi",
      genre: "Drama",
      certification: "UA 13+",
      releaseDate: new Date("2026-10-22T00:00:00.000Z"),
    },
    {
      id: deterministicUuid(103),
      title: "Code Red",
      description:
        "A cybersecurity analyst races to stop a city-wide infrastructure attack.",
      duration: 116,
      language: "English",
      genre: "Thriller",
      certification: "UA 16+",
      releaseDate: new Date("2026-10-29T00:00:00.000Z"),
    },
  ];

  for (const movie of movies) {
    await prisma.movie.upsert({
      where: {
        id: movie.id,
      },
      create: {
        ...movie,
        status: MovieStatus.ACTIVE,
      },
      update: {},
    });
  }

  const theatres = [
    {
      id: deterministicUuid(201),
      name: "CineSquare Thane",
      address: "Eastern Express Highway, Thane, Maharashtra",
      city: "Thane",
    },
    {
      id: deterministicUuid(202),
      name: "MetroPoint Dombivli",
      address: "Manpada Road, Dombivli, Maharashtra",
      city: "Dombivli",
    },
  ];

  for (const theatre of theatres) {
    await prisma.theatre.upsert({
      where: {
        id: theatre.id,
      },
      create: theatre,
      update: {},
    });
  }

  const screens = [
    {
      id: deterministicUuid(301),
      theatreId: deterministicUuid(201),
      name: "Screen 1",
    },
    {
      id: deterministicUuid(302),
      theatreId: deterministicUuid(202),
      name: "Screen 1",
    },
  ];

  for (const screen of screens) {
    await prisma.screen.upsert({
      where: {
        id: screen.id,
      },
      create: screen,
      update: {},
    });
  }

  const sections = [
    {
      id: deterministicUuid(401),
      screenId: deterministicUuid(301),
      name: "Silver",
      category: SeatCategory.STANDARD,
      basePrice: "180.00",
      seatType: SeatType.STANDARD,
      rows: ["A", "B"],
      seatsPerRow: 8,
    },
    {
      id: deterministicUuid(402),
      screenId: deterministicUuid(301),
      name: "Gold",
      category: SeatCategory.PREMIUM,
      basePrice: "260.00",
      seatType: SeatType.PREMIUM,
      rows: ["C"],
      seatsPerRow: 6,
    },
    {
      id: deterministicUuid(403),
      screenId: deterministicUuid(302),
      name: "Silver",
      category: SeatCategory.STANDARD,
      basePrice: "180.00",
      seatType: SeatType.STANDARD,
      rows: ["A", "B"],
      seatsPerRow: 8,
    },
    {
      id: deterministicUuid(404),
      screenId: deterministicUuid(302),
      name: "Gold",
      category: SeatCategory.PREMIUM,
      basePrice: "260.00",
      seatType: SeatType.PREMIUM,
      rows: ["C"],
      seatsPerRow: 6,
    },
  ];

  let seatSequence = 1;

  for (const section of sections) {
    await prisma.seatSection.upsert({
      where: {
        id: section.id,
      },
      create: {
        id: section.id,
        screenId: section.screenId,
        name: section.name,
        category: section.category,
        basePrice: section.basePrice,
      },
      update: {},
    });

    for (const rowLabel of section.rows) {
      for (
        let seatNumber = 1;
        seatNumber <= section.seatsPerRow;
        seatNumber += 1
      ) {
        const seatId = deterministicUuid(
          5000 + seatSequence,
        );

        seatSequence += 1;

        await prisma.seat.upsert({
          where: {
            id: seatId,
          },
          create: {
            id: seatId,
            screenId: section.screenId,
            sectionId: section.id,
            rowLabel,
            seatNumber,
            seatType: section.seatType,
          },
          update: {},
        });
      }
    }
  }
}

async function seedShowsAndInventory() {
  const showDefinitions = [
    {
      id: deterministicUuid(601),
      movieId: deterministicUuid(101),
      screenId: deterministicUuid(301),
      startTime: utcDateInDays(1, 10, 0),
      duration: 142,
    },
    {
      id: deterministicUuid(602),
      movieId: deterministicUuid(102),
      screenId: deterministicUuid(301),
      startTime: utcDateInDays(1, 14, 0),
      duration: 128,
    },
    {
      id: deterministicUuid(603),
      movieId: deterministicUuid(103),
      screenId: deterministicUuid(302),
      startTime: utcDateInDays(1, 18, 30),
      duration: 116,
    },
    {
      id: deterministicUuid(604),
      movieId: deterministicUuid(101),
      screenId: deterministicUuid(302),
      startTime: utcDateInDays(2, 11, 0),
      duration: 142,
    },
  ];

  for (const definition of showDefinitions) {
    await prisma.$transaction(async (tx) => {
      const show = await tx.show.upsert({
        where: {
          id: definition.id,
        },
        create: {
          id: definition.id,
          movieId: definition.movieId,
          screenId: definition.screenId,
          startTime: definition.startTime,
          endTime: addMinutes(
            definition.startTime,
            definition.duration + 20,
          ),
          status: ShowStatus.SCHEDULED,
        },
        update: {},
        select: {
          id: true,
          screenId: true,
        },
      });

      const sections = await tx.seatSection.findMany({
        where: {
          screenId: show.screenId,
        },
        select: {
          id: true,
          basePrice: true,
        },
        orderBy: {
          id: "asc",
        },
      });

      const showSequence = Number.parseInt(
        show.id.slice(-4),
        16,
      );

      // Create show-specific prices using the section base price.
      // Existing show prices are deliberately never overwritten.
      await tx.showSectionPrice.createMany({
        data: sections.map((section, index) => ({
          id: deterministicUuid(
            20_000 + showSequence * 10 + index,
          ),
          showId: show.id,
          screenId: show.screenId,
          sectionId: section.id,
          price: section.basePrice,
        })),
        skipDuplicates: true,
      });

      const seats = await tx.seat.findMany({
        where: {
          screenId: show.screenId,
        },
        select: {
          id: true,
        },
        orderBy: {
          id: "asc",
        },
      });

      await tx.showSeat.createMany({
        data: seats.map((seat, index) => ({
          id: deterministicUuid(
            10_000 + showSequence * 100 + index,
          ),
          showId: show.id,
          screenId: show.screenId,
          seatId: seat.id,
          status: ShowSeatStatus.AVAILABLE,
        })),
        // Never reset existing HELD or BOOKED inventory.
        skipDuplicates: true,
      });
    });
  }
}

async function main() {
  await seedUsers();
  await seedCatalogue();
  await seedShowsAndInventory();

  const [
    movieCount,
    theatreCount,
    screenCount,
    seatCount,
    showCount,
    inventoryCount,
    showPriceCount,
  ] = await Promise.all([
    prisma.movie.count(),
    prisma.theatre.count(),
    prisma.screen.count(),
    prisma.seat.count(),
    prisma.show.count(),
    prisma.showSeat.count(),
    prisma.showSectionPrice.count(),
  ]);

  console.info("Development seed completed:", {
    movieCount,
    theatreCount,
    screenCount,
    seatCount,
    showCount,
    inventoryCount,
    showPriceCount,
  });
}

main()
  .catch((error: unknown) => {
    console.error("Development seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
