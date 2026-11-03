import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/csrf";

import {
  bookingListQuerySchema,
  createBookingSchema,
  idempotencyKeySchema,
} from "@/modules/bookings/booking.validation";

import { BookingError } from "@/modules/bookings/booking.errors";
import {
  createBooking,
  listCustomerBookings,
} from "@/modules/bookings/booking.service";

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

  console.error("Booking API error:", error);

  return NextResponse.json(
    {
      success: false,
      message: "An unexpected booking error occurred.",
      code: "INTERNAL_SERVER_ERROR",
    },
    { status: 500 },
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request origin.",
          code: "INVALID_ORIGIN",
        },
        { status: 403 },
      );
    }

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

    const rawKey = request.headers.get("Idempotency-Key");
    const keyResult = idempotencyKeySchema.safeParse(rawKey);

    if (!keyResult.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A valid Idempotency-Key header is required.",
          code: "INVALID_IDEMPOTENCY_KEY",
        },
        { status: 400 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON request body.",
          code: "INVALID_BOOKING_REQUEST",
        },
        { status: 400 },
      );
    }

    const bodyResult = createBookingSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid booking request.",
          code: "INVALID_BOOKING_REQUEST",
          issues: bodyResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const result = await createBooking({
      userId: user.id,
      holdId: bodyResult.data.holdId,
      idempotencyKey: keyResult.data,
    });

    return NextResponse.json(
      {
        success: true,
        data: result.booking,
        replayed: result.replayed,
      },
      {
        status: result.replayed ? 200 : 201,
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: NextRequest) {
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

    const url = new URL(request.url);

    const queryResult = bookingListQuerySchema.safeParse({
      page: url.searchParams.get("page") ?? "1",
      pageSize: url.searchParams.get("pageSize") ?? "10",
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid pagination parameters.",
          code: "INVALID_BOOKING_REQUEST",
        },
        { status: 400 },
      );
    }

    const result = await listCustomerBookings(
      user.id,
      queryResult.data.page,
      queryResult.data.pageSize,
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return errorResponse(error);
  }
}