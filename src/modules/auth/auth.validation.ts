import { z } from "zod";

import type { NormalizedIdentifier } from "./auth.types";

const MAX_IDENTIFIER_LENGTH = 320;

/**
 * Indian mobile number rules:
 *
 * Local format: 9876543210
 * E.164 format: +919876543210
 *
 * Local mobile numbers are normalized to E.164.
 * Other country codes and ambiguous formats are rejected.
 */
const INDIAN_MOBILE_LOCAL_REGEX = /^[6-9]\d{9}$/;
const INDIAN_MOBILE_E164_REGEX = /^\+91[6-9]\d{9}$/;

/**
 * Normalizes an email or Indian mobile number.
 *
 * Email:
 * - Removes surrounding whitespace.
 * - Converts to lowercase.
 * - Validates email format.
 *
 * Mobile:
 * - Accepts exactly 10 local digits.
 * - Accepts +91 followed by 10 digits.
 * - Converts local numbers to +91 E.164 format.
 *
 * Returns null for invalid identifiers.
 */
export function normalizeIdentifier(
  rawIdentifier: string,
): NormalizedIdentifier | null {
  const identifier = rawIdentifier.trim();

  if (!identifier || identifier.length > MAX_IDENTIFIER_LENGTH) {
    return null;
  }

  // An identifier containing @ is treated as an email address.
  if (identifier.includes("@")) {
    const normalizedEmail = identifier.toLowerCase();

    const emailResult = z.email().safeParse(normalizedEmail);

    if (!emailResult.success) {
      return null;
    }

    return {
      kind: "email",
      value: emailResult.data,
    };
  }

  // Accept a 10-digit Indian mobile number.
  if (INDIAN_MOBILE_LOCAL_REGEX.test(identifier)) {
    return {
      kind: "phone",
      value: `+91${identifier}`,
    };
  }

  // Accept an already normalized Indian E.164 number.
  if (INDIAN_MOBILE_E164_REGEX.test(identifier)) {
    return {
      kind: "phone",
      value: identifier,
    };
  }

  return null;
}

/**
 * Shared identifier validation.
 *
 * The transformed output is a NormalizedIdentifier object,
 * not the original untrusted string.
 */
const identifierSchema = z
  .string()
  .trim()
  .min(1, "Identifier is required.")
  .max(MAX_IDENTIFIER_LENGTH, "Identifier is too long.")
  .transform((identifier, context) => {
    const normalized = normalizeIdentifier(identifier);

    if (!normalized) {
      context.addIssue({
        code: "custom",
        message:
          "Enter a valid email address or Indian mobile number.",
      });

      return z.NEVER;
    }

    return normalized;
  });

/**
 * POST /api/auth/request-otp
 */
export const requestOtpSchema = z
  .object({
    identifier: identifierSchema,
  })
  .strict();

/**
 * POST /api/auth/verify-otp
 *
 * OTP must contain exactly six digits.
 * Actual OTP verification belongs to the authentication service.
 */
export const verifyOtpSchema = z
  .object({
    identifier: identifierSchema,
    otp: z
      .string()
      .regex(/^\d{6}$/, "OTP must contain exactly six digits."),
  })
  .strict();

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;