import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/csrf";

import {
  createHoldBodySchema,
  showIdSchema,
} from "@/modules/holds/hold.validation";

import { HoldError } from "@/modules/holds/hold.errors";
import { createSeatHold } from "@/modules/holds/hold.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    showId: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
) {
  // 1. Verify Origin before processing a cookie-authenticated POST.
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid request origin.",
      },
      { status: 403 },
    );
  }

  // 2. Authenticate using the existing database-backed session.
  let user;

  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Unable to verify your session.",
      },
      { status: 500 },
    );
  }

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

  // 3. Validate show ID.
  const { showId } = await context.params;

  const showValidation = showIdSchema.safeParse(showId);

  if (!showValidation.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid show ID.",
      },
      { status: 400 },
    );
  }

  // 4. Parse request body.
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Request body must contain valid JSON.",
      },
      { status: 400 },
    );
  }

  // 5. Validate seat selection.
  const validation = createHoldBodySchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        message:
          validation.error.issues[0]?.message ??
          "Invalid seat selection.",
        errors: validation.error.issues.map((issue) => ({
          path: issue.path.map(String),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  // 6. Execute the transactional hold operation.
  try {
    const data = await createSeatHold({
      userId: user.id,
      showId: showValidation.data,
      seatIds: validation.data.seatIds,
    });

    return NextResponse.json(
      {
        success: true,
        data,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof HoldError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          code: error.code,
        },
        {
          status: error.status,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    // Do not expose SQL, Prisma details or stack traces.
    console.error("Seat hold creation failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to reserve the selected seats.",
      },
      { status: 500 },
    );
  }
}