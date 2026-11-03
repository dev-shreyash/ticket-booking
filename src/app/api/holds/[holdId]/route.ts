import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/csrf";

import { HoldError } from "@/modules/holds/hold.errors";
import { releaseSeatHold } from "@/modules/holds/hold-release.service";
import { getHoldStatus } from "@/modules/holds/hold-status.repository";

type RouteContext = {
  params: Promise<{
    holdId: string;
  }>;
};

function errorResponse(error: unknown) {
  if (error instanceof HoldError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
        code: error.code,
      },
      {
        status: error.status,
      },
    );
  }

  console.error("Hold API error:", error);

  return NextResponse.json(
    {
      success: false,
      message: "An unexpected error occurred while processing the hold.",
      code: "INTERNAL_SERVER_ERROR",
    },
    {
      status: 500,
    },
  );
}

async function getValidatedHoldId(context: RouteContext) {
  const { holdId: rawHoldId } = await context.params;

  const result = z.string().uuid().safeParse(rawHoldId);

  return result.success ? result.data : null;
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

    const holdId = await getValidatedHoldId(context);

    if (!holdId) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid hold ID.",
          code: "INVALID_HOLD_REQUEST",
        },
        { status: 400 },
      );
    }

    const data = await getHoldStatus(
      holdId,
      user.id,
      user.role === "ADMIN",
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
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

    const holdId = await getValidatedHoldId(context);

    if (!holdId) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid hold ID.",
          code: "INVALID_HOLD_REQUEST",
        },
        { status: 400 },
      );
    }

    const data = await releaseSeatHold({
      holdId,
      userId: user.id,
      isAdmin: user.role === "ADMIN",
    });

    return NextResponse.json({
      success: true,
      message:
        data.status === "EXPIRED"
          ? "The hold expired and its seats have been released."
          : "Hold released successfully.",
      data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}