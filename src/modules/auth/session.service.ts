import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

import type { AuthUser } from "./auth.types";

export const SESSION_COOKIE_NAME = "movie_booking_session";

export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

export function generateSessionCredentials(): {
  rawToken: string;
  tokenHash: string;
} {
  const rawToken = randomBytes(32).toString("base64url");

  const tokenHash = createHash("sha256")
    .update(rawToken)
    .digest("hex");

  return {
    rawToken,
    tokenHash,
  };
}

export function hashSessionToken(rawToken: string): string {
  return createHash("sha256")
    .update(rawToken)
    .digest("hex");
}

/**
 * PostgreSQL checks expiry using its own clock.
 * Raw session tokens are never queried or persisted.
 */
export async function findSessionUser(
  rawToken: string,
): Promise<AuthUser | null> {
  if (!rawToken || rawToken.length > 200) {
    return null;
  }

  const tokenHash = hashSessionToken(rawToken);

  const users = await prisma.$queryRaw<AuthUser[]>`
    SELECT
      u."id",
      u."name",
      u."email",
      u."phone",
      u."role"::text AS "role"
    FROM "Session" s
    INNER JOIN "User" u
      ON u."id" = s."userId"
    WHERE s."tokenHash" = ${tokenHash}
      AND s."expiresAt" > clock_timestamp()
    LIMIT 1
  `;

  return users[0] ?? null;
}

export async function revokeSession(
  rawToken: string,
): Promise<void> {
  if (!rawToken || rawToken.length > 200) {
    return;
  }

  const tokenHash = hashSessionToken(rawToken);

  await prisma.session.deleteMany({
    where: { tokenHash },
  });
}