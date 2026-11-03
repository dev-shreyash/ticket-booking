import { timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";

import type {
  AuthUser,
  NormalizedIdentifier,
} from "./auth.types";

const MAX_OTP_ATTEMPTS = 5;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

type LockedOtp = {
  id: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  attemptCount: number;
};

export type VerifyOtpDatabaseResult =
  | { status: "NOT_FOUND" }
  | { status: "EXPIRED" }
  | { status: "INVALID" }
  | { status: "ATTEMPTS_EXCEEDED" }
  | {
      status: "SUCCESS";
      user: AuthUser;
      expiresAt: Date;
    };

function hashesMatch(
  storedHash: string,
  submittedHash: string,
): boolean {
  if (
    !/^[0-9a-f]{64}$/.test(storedHash) ||
    !/^[0-9a-f]{64}$/.test(submittedHash)
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(storedHash, "hex"),
    Buffer.from(submittedHash, "hex"),
  );
}

export async function replacePendingOtp(
  identifier: string,
  codeHash: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ locked: number }>>`
      SELECT 1 AS locked
      FROM pg_advisory_xact_lock(
        hashtextextended(${identifier}, 0)
      )
    `;

    const [clock] = await tx.$queryRaw<
      Array<{ databaseNow: Date }>
    >`
      SELECT clock_timestamp() AS "databaseNow"
    `;

    if (!clock) {
      throw new Error("Database clock unavailable.");
    }

    const now = clock.databaseNow;

    await tx.otpVerification.updateMany({
      where: {
        identifier,
        consumedAt: null,
      },
      data: {
        consumedAt: now,
      },
    });

    await tx.otpVerification.create({
      data: {
        identifier,
        codeHash,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        attemptCount: 0,
      },
    });
  });
}

export async function verifyOtpAndCreateSession(input: {
  identifier: NormalizedIdentifier;
  submittedCodeHash: string;
  sessionTokenHash: string;
}): Promise<VerifyOtpDatabaseResult> {
  return prisma.$transaction(async (tx) => {
    const {
      identifier,
      submittedCodeHash,
      sessionTokenHash,
    } = input;

    await tx.$queryRaw<Array<{ locked: number }>>`
      SELECT 1 AS locked
      FROM pg_advisory_xact_lock(
        hashtextextended(${identifier.value}, 0)
      )
    `;

    const otpRows = await tx.$queryRaw<LockedOtp[]>`
      SELECT
        "id",
        "codeHash",
        "expiresAt",
        "consumedAt",
        "attemptCount"
      FROM "OtpVerification"
      WHERE "identifier" = ${identifier.value}
        AND "consumedAt" IS NULL
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT 1
      FOR UPDATE
    `;

    const otp = otpRows[0];

    if (!otp) {
      return { status: "NOT_FOUND" };
    }

    const [clock] = await tx.$queryRaw<
      Array<{ databaseNow: Date }>
    >`
      SELECT clock_timestamp() AS "databaseNow"
    `;

    if (!clock) {
      throw new Error("Database clock unavailable.");
    }

    const now = clock.databaseNow;

    if (otp.expiresAt.getTime() <= now.getTime()) {
      await tx.otpVerification.update({
        where: { id: otp.id },
        data: { consumedAt: now },
      });

      return { status: "EXPIRED" };
    }

    if (otp.attemptCount >= MAX_OTP_ATTEMPTS) {
      await tx.otpVerification.update({
        where: { id: otp.id },
        data: { consumedAt: now },
      });

      return { status: "ATTEMPTS_EXCEEDED" };
    }

    if (!hashesMatch(otp.codeHash, submittedCodeHash)) {
      const nextAttemptCount = otp.attemptCount + 1;

      await tx.otpVerification.update({
        where: { id: otp.id },
        data: {
          attemptCount: nextAttemptCount,
          ...(nextAttemptCount >= MAX_OTP_ATTEMPTS
            ? { consumedAt: now }
            : {}),
        },
      });

      return nextAttemptCount >= MAX_OTP_ATTEMPTS
        ? { status: "ATTEMPTS_EXCEEDED" }
        : { status: "INVALID" };
    }

    const existingUser =
      identifier.kind === "email"
        ? await tx.user.findUnique({
            where: { email: identifier.value },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
            },
          })
        : await tx.user.findUnique({
            where: { phone: identifier.value },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
            },
          });

    const user =
      existingUser ??
      (await tx.user.create({
        data:
          identifier.kind === "email"
            ? { email: identifier.value }
            : { phone: identifier.value },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
      }));

    await tx.otpVerification.update({
      where: { id: otp.id },
      data: { consumedAt: now },
    });

    const expiresAt = new Date(
      now.getTime() + SESSION_DURATION_MS,
    );

    await tx.session.create({
      data: {
        userId: user.id,
        tokenHash: sessionTokenHash,
        createdAt: now,
        expiresAt,
      },
    });

    return {
      status: "SUCCESS",
      user,
      expiresAt,
    };
  });
}