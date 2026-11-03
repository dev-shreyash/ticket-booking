import { NextResponse } from "next/server";

import { isSameOriginRequest } from "@/lib/csrf";

import { requestOtpSchema } from "@/modules/auth/auth.validation";
import { requestOtp } from "@/modules/auth/auth.service";

export const runtime = "nodejs";

function getClientIp(request: Request): string | null {
  const realIp = request.headers.get("x-real-ip")?.trim();

  if (realIp) {
    return realIp;
  }

  const forwardedFor = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  return forwardedFor || null;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid request origin.",
      },
      { status: 403 },
    );
  }

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

  const validation = requestOtpSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        message:
          validation.error.issues[0]?.message ??
          "Invalid request.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await requestOtp(
      validation.data.identifier,
      getClientIp(request),
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Too many OTP requests. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfterSeconds),
          },
        },
      );
    }

    return NextResponse.json({
      success: true,
      message: "OTP requested successfully.",
    });
   } catch (error) {
    console.error(
      "[POST /api/auth/request-otp] Failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message: "Unable to process the OTP request.",
      },
      { status: 500 },
    );
  }
}