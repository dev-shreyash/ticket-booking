import { prisma } from "@/lib/prisma";

import { BookingError } from "./booking.errors";

export async function listBookingsForUser(
  userId: string,
  page: number,
  pageSize: number,
) {
  const skip = (page - 1) * pageSize;

  const where = {
    userId,
  };

  const [bookings, totalItems] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip,
      take: pageSize,
      include: {
        show: {
          include: {
            movie: true,
            screen: {
              include: {
                theatre: true,
              },
            },
          },
        },
        bookingSeats: {
          orderBy: {
            seatId: "asc",
          },
        },
      },
    }),

    prisma.booking.count({
      where,
    }),
  ]);

  return {
    items: bookings.map((booking) => ({
      id: booking.id,
      bookingReference: booking.bookingReference,
      status: booking.status,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus,
      totalAmount: booking.totalAmount.toFixed(2),
      createdAt: booking.createdAt.toISOString(),

      movie: {
        id: booking.show.movie.id,
        title: booking.show.movie.title,
        posterUrl: booking.show.movie.posterUrl,
      },

      theatre: {
        name: booking.show.screen.theatre.name,
        city: booking.show.screen.theatre.city,
      },

      screen: booking.show.screen.name,
      showStartTime: booking.show.startTime.toISOString(),

      seats: booking.bookingSeats.map((seat) => ({
        seatLabel: seat.seatLabelSnapshot,
        section: seat.sectionSnapshot,
        seatType: seat.seatTypeSnapshot,
        price: seat.price.toFixed(2),
      })),
    })),

    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
      hasNextPage: skip + bookings.length < totalItems,
    },
  };
}

export async function getBookingForUser(
  bookingId: string,
  userId: string,
) {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
    },
    include: {
      show: {
        include: {
          movie: true,
          screen: {
            include: {
              theatre: true,
            },
          },
        },
      },
      bookingSeats: {
        orderBy: {
          seatId: "asc",
        },
      },
    },
  });

  if (!booking) {
    throw new BookingError(
      "BOOKING_NOT_FOUND",
      "Booking not found.",
    );
  }

  return {
    id: booking.id,
    bookingReference: booking.bookingReference,
    status: booking.status,
    paymentMethod: booking.paymentMethod,
    paymentStatus: booking.paymentStatus,
    totalAmount: booking.totalAmount.toFixed(2),
    createdAt: booking.createdAt.toISOString(),

    movie: {
      id: booking.show.movie.id,
      title: booking.show.movie.title,
      posterUrl: booking.show.movie.posterUrl,
      language: booking.show.movie.language,
      duration: booking.show.movie.duration,
      certification: booking.show.movie.certification,
    },

    theatre: {
      name: booking.show.screen.theatre.name,
      address: booking.show.screen.theatre.address,
      city: booking.show.screen.theatre.city,
    },

    screen: booking.show.screen.name,

    show: {
      startTime: booking.show.startTime.toISOString(),
      endTime: booking.show.endTime.toISOString(),
    },

    seats: booking.bookingSeats.map((seat) => ({
      seatId: seat.seatId,
      seatLabel: seat.seatLabelSnapshot,
      section: seat.sectionSnapshot,
      seatType: seat.seatTypeSnapshot,
      price: seat.price.toFixed(2),
    })),
  };
}