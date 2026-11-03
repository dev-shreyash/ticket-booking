import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";

import { BookingError } from "@/modules/bookings/booking.errors";
import { getCustomerBooking } from "@/modules/bookings/booking.service";

type RouteContext = {
  params: Promise<{
    bookingId: string;
  }>;
};

function errorResponse(error: unknown) {
  if (error instanceof BookingError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
        code: error.code,
      },
      { status: error.status },
    );
  }

  console.error("Booking detail API error:", error);

  return NextResponse.json(
    {
      success: false,
      message: "Unable to retrieve booking.",
      code: "INTERNAL_SERVER_ERROR",
    },
    { status: 500 },
  );
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required. Please sign in.",
          code: "UNAUTHENTICATED",
        },
        { status: 401 },
      );
    }

    const { bookingId: rawBookingId } = await context.params;

    const parsed = z.string().uuid().safeParse(rawBookingId);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid booking ID.",
          code: "INVALID_BOOKING_REQUEST",
        },
        { status: 400 },
      );
    }

    const booking = await getCustomerBooking(
      parsed.data,
      user.id,
    );

    return NextResponse.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    return errorResponse(error);
  }
}