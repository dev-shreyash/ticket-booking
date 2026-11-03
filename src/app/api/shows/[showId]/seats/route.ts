import { NextResponse } from "next/server";

import { seatMapShowIdSchema } from "@/modules/seats/seat.validation";

import {
  getShowSeatMap,
  SeatMapNotFoundError,
  SeatMapIntegrityError,
} from "@/modules/seats/seat.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    showId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const { showId } = await context.params;

  const validation = seatMapShowIdSchema.safeParse(showId);

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid show ID.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  try {
    const data = await getShowSeatMap(validation.data);

    return NextResponse.json(
      {
        success: true,
        data,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    if (error instanceof SeatMapNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 404 },
      );
    }

    if (error instanceof SeatMapIntegrityError) {
      console.error("Seat inventory integrity error:", error.message);

      return NextResponse.json(
        {
          success: false,
          message:
            "Seat information is temporarily unavailable. Please try again.",
        },
        { status: 409 },
      );
    }

    console.error("Seat map API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to retrieve seat availability.",
      },
      { status: 500 },
    );
  }
}