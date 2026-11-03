import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getServerEnvironment } from "@/lib/env";
import { isSameOriginRequest } from "@/lib/csrf";

import { verifyOtpSchema } from "@/modules/auth/auth.validation";
import { verifyOtp } from "@/modules/auth/auth.service";

import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "@/modules/auth/session.service";

export const runtime = "nodejs";

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
        message: "Invalid JSON request body.",
      },
      { status: 400 },
    );
  }

  const validation = verifyOtpSchema.safeParse(body);

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
    const result = await verifyOtp({
      identifier: validation.data.identifier,
      otp: validation.data.otp,
    });

    if (!result.success) {
      const attemptsExceeded =
        result.reason === "ATTEMPTS_EXCEEDED";

      return NextResponse.json(
        {
          success: false,
          message: attemptsExceeded
            ? "Too many incorrect attempts. Request a new OTP."
            : "Invalid or expired OTP. Please try again.",
        },
        {
          status: attemptsExceeded ? 429 : 400,
        },
      );
    }

    const environment = getServerEnvironment();

    const response = NextResponse.json({
      success: true,
      user: result.user,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: result.rawSessionToken,
      httpOnly: true,
      secure: environment.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
      expires: result.expiresAt,
    });

    return response;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Unable to verify OTP. Please try again.",
      },
      { status: 500 },
    );
  }
}