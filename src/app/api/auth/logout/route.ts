import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getServerEnvironment } from "@/lib/env";
import { isSameOriginRequest } from "@/lib/csrf";

import {
  revokeSession,
  SESSION_COOKIE_NAME,
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

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  let revokeFailed = false;

  try {
    if (token) {
      await revokeSession(token);
    }
  } catch {
    revokeFailed = true;
  }

  const environment = getServerEnvironment();

  const response = NextResponse.json(
    revokeFailed
      ? {
          success: false,
          message: "Unable to revoke the session.",
        }
      : {
          success: true,
          message: "Logged out successfully.",
        },
    {
      status: revokeFailed ? 500 : 200,
    },
  );

  // Always remove the browser's cookie, even if already logged out.
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: environment.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}