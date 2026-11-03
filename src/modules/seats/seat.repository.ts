import { prisma } from "@/lib/prisma";

export class SeatMapIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeatMapIntegrityError";
  }
}

/**
 * Retrieves a public seat map for a scheduled, upcoming show.
 *
 * The entire operation is read-only. It never reclaims, releases,
 * or modifies seat inventory.
 */
export async function findSeatMap(showId: string) {
  return prisma.$transaction(async (tx) => {
    // First database clock reading: validate show availability.
    const [initialClock] = await tx.$queryRaw<
      Array<{ databaseNow: Date }>
    >`
      SELECT clock_timestamp() AS "databaseNow"
    `;

    if (!initialClock) {
      throw new Error("Unable to obtain database time.");
    }

    const show = await tx.show.findFirst({
      where: {
        id: showId,
        status: "SCHEDULED",
        startTime: {
          gt: initialClock.databaseNow,
        },
        movie: {
          is: {
            status: "ACTIVE",
          },
        },
      },

      select: {
        id: true,
        startTime: true,
        endTime: true,

        movie: {
          select: {
            title: true,
          },
        },

        screen: {
          select: {
            name: true,

            theatre: {
              select: {
                name: true,
                address: true,
                city: true,
              },
            },

            sections: {
              orderBy: [
                { name: "asc" },
                { id: "asc" },
              ],

              select: {
                id: true,
                name: true,
                category: true,

                showPrices: {
                  where: {
                    showId,
                  },
                  select: {
                    price: true,
                  },
                },

                seats: {
                  orderBy: [
                    { rowLabel: "asc" },
                    { seatNumber: "asc" },
                  ],

                  select: {
                    id: true,
                    rowLabel: true,
                    seatNumber: true,
                    seatType: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!show) {
      return null;
    }

    // Retrieve all inventory belonging to this specific show.
    const inventory = await tx.showSeat.findMany({
      where: {
        showId: show.id,
      },

      select: {
        seatId: true,
        status: true,

        hold: {
          select: {
            status: true,
            expiresAt: true,
          },
        },
      },
    });

    // Use a fresh database time for effective hold expiry.
    const [availabilityClock] = await tx.$queryRaw<
      Array<{ databaseNow: Date }>
    >`
      SELECT clock_timestamp() AS "databaseNow"
    `;

    if (!availabilityClock) {
      throw new Error("Unable to obtain availability time.");
    }

    const databaseNow = availabilityClock.databaseNow;

    const inventoryBySeat = new Map(
      inventory.map((record) => [
        record.seatId,
        record,
      ]),
    );

    const physicalSeatCount = show.screen.sections.reduce(
      (count, section) => count + section.seats.length,
      0,
    );

    // Never infer that missing inventory means AVAILABLE.
    if (inventoryBySeat.size !== physicalSeatCount) {
      throw new SeatMapIntegrityError(
        "Seat inventory is incomplete for this show. Please contact support.",
      );
    }

    let availableSeats = 0;
    let heldSeats = 0;
    let bookedSeats = 0;

    const sections = show.screen.sections.map((section) => {
      const priceRecord = section.showPrices[0];

      if (!priceRecord) {
        throw new SeatMapIntegrityError(
          `Pricing is missing for section ${section.name}.`,
        );
      }

      const rows = new Map<
        string,
        {
          label: string;
          seats: {
            id: string;
            label: string;
            seatNumber: number;
            seatType: string;
            status: "AVAILABLE" | "HELD" | "BOOKED";
          }[];
        }
      >();

      for (const seat of section.seats) {
        const allocation = inventoryBySeat.get(seat.id);

        if (!allocation) {
          throw new SeatMapIntegrityError(
            `Inventory is missing for seat ${seat.rowLabel}${seat.seatNumber}.`,
          );
        }

        let effectiveStatus:
          | "AVAILABLE"
          | "HELD"
          | "BOOKED";

        if (allocation.status === "BOOKED") {
          effectiveStatus = "BOOKED";
        } else if (allocation.status === "HELD") {
          if (!allocation.hold) {
            throw new SeatMapIntegrityError(
              `Held seat ${seat.rowLabel}${seat.seatNumber} has no associated hold.`,
            );
          }

          const holdIsActive =
            allocation.hold.status === "ACTIVE" &&
            allocation.hold.expiresAt > databaseNow;

          effectiveStatus = holdIsActive
            ? "HELD"
            : "AVAILABLE";
        } else {
          effectiveStatus = "AVAILABLE";
        }

        if (effectiveStatus === "AVAILABLE") {
          availableSeats++;
        } else if (effectiveStatus === "HELD") {
          heldSeats++;
        } else {
          bookedSeats++;
        }

        let row = rows.get(seat.rowLabel);

        if (!row) {
          row = {
            label: seat.rowLabel,
            seats: [],
          };

          rows.set(seat.rowLabel, row);
        }

        row.seats.push({
          id: seat.id,
          label: `${seat.rowLabel}${seat.seatNumber}`,
          seatNumber: seat.seatNumber,
          seatType: seat.seatType,
          status: effectiveStatus,
        });
      }

      return {
        id: section.id,
        name: section.name,
        category: section.category,
        price: priceRecord.price.toFixed(2),
        rows: Array.from(rows.values()),
      };
    });

    if (inventoryBySeat.size !== physicalSeatCount) {
      throw new SeatMapIntegrityError(
        "Unexpected inventory records found for this show.",
      );
    }

    return {
      show: {
        id: show.id,
        startTime: show.startTime.toISOString(),
        endTime: show.endTime.toISOString(),

        movie: {
          title: show.movie.title,
        },

        theatre: show.screen.theatre,

        screen: {
          name: show.screen.name,
        },
      },

      sections,

      summary: {
        totalSeats: physicalSeatCount,
        availableSeats,
        heldSeats,
        bookedSeats,
      },
    };
  });
}