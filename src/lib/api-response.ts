import { NextResponse } from "next/server";
import type { ZodError } from "zod";

import { AppError } from "@/lib/errors";

export function successResponse<T extends Record<string, unknown>>(
  payload: T,
  status = 200,
) {
  return NextResponse.json(
    { success: true, ...payload },
    { status },
  );
}

export function validationErrorResponse(error: ZodError) {
  return NextResponse.json(
    {
      success: false,
      message: "Invalid request parameters.",
      errors: error.issues.map((issue) => ({
        path: issue.path.map(String),
        message: issue.message,
      })),
    },
    { status: 400 },
  );
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
        code: error.code,
      },
      { status: error.statusCode },
    );
  }

  // Keep internal database details out of the HTTP response.
  console.error("Catalogue API error:", error);

  return NextResponse.json(
    {
      success: false,
      message: "An unexpected error occurred.",
    },
    { status: 500 },
  );
}
