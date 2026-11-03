import {
  createHmac,
} from "node:crypto";

import { getServerEnvironment } from "@/lib/env";

import {
  replacePendingOtp,
  verifyOtpAndCreateSession,
} from "./auth.repository";

import { consumeOtpRequestLimit } from "./auth.rate-limit";

import {
  generateSessionCredentials,
} from "./session.service";

import type {
  AuthUser,
  NormalizedIdentifier,
} from "./auth.types";

const DEMO_OTP = "123456";

function hashOtp(otp: string): string {
  const { SESSION_SECRET } = getServerEnvironment();

  return createHmac("sha256", SESSION_SECRET)
    .update(otp)
    .digest("hex");
}

export type RequestOtpResult =
  | { success: true }
  | {
      success: false;
      retryAfterSeconds: number;
    };

export async function requestOtp(
  identifier: NormalizedIdentifier,
  clientIp: string | null,
): Promise<RequestOtpResult> {
  const rateLimit = consumeOtpRequestLimit(
    identifier.value,
    clientIp,
  );

  if (!rateLimit.allowed) {
    return {
      success: false,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  await replacePendingOtp(
    identifier.value,
    hashOtp(DEMO_OTP),
  );

  return { success: true };
}

export type VerifyOtpResult =
  | {
      success: true;
      user: AuthUser;
      rawSessionToken: string;
      expiresAt: Date;
    }
  | {
      success: false;
      reason:
        | "NOT_FOUND"
        | "EXPIRED"
        | "INVALID"
        | "ATTEMPTS_EXCEEDED";
    };

export async function verifyOtp(input: {
  identifier: NormalizedIdentifier;
  otp: string;
}): Promise<VerifyOtpResult> {
  const credentials = generateSessionCredentials();

  const result = await verifyOtpAndCreateSession({
    identifier: input.identifier,
    submittedCodeHash: hashOtp(input.otp),
    sessionTokenHash: credentials.tokenHash,
  });

  if (result.status !== "SUCCESS") {
    return {
      success: false,
      reason: result.status,
    };
  }

  return {
    success: true,
    user: result.user,
    rawSessionToken: credentials.rawToken,
    expiresAt: result.expiresAt,
  };
}