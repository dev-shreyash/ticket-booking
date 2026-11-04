
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { UserDocumentType } from "@/lib/document-validation";

export type SaveUserDocumentInput = {
  userId: string;
  type: UserDocumentType;
  objectKey: string;
  fileName: string;
  contentType: string;
  fileSize: number;
};

async function lockDocumentType(
  tx: Prisma.TransactionClient,
  userId: string,
  type: UserDocumentType,
) {
  await tx.$queryRaw`
    WITH lock_result AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`${userId}:${type}`}, 8621)
      )
    )
    SELECT 1::integer AS locked
    FROM lock_result
  `;
}

export async function saveUserDocument(
  input: SaveUserDocumentInput,
) {
  return prisma.$transaction(async (tx) => {
    await lockDocumentType(tx, input.userId, input.type);

    const previous = await tx.userDocument.findUnique({
      where: {
        userId_type: {
          userId: input.userId,
          type: input.type,
        },
      },
      select: {
        objectKey: true,
      },
    });

    const document = await tx.userDocument.upsert({
      where: {
        userId_type: {
          userId: input.userId,
          type: input.type,
        },
      },
      create: input,
      update: {
        objectKey: input.objectKey,
        fileName: input.fileName,
        contentType: input.contentType,
        fileSize: input.fileSize,
      },
    });

    return {
      document,
      previousObjectKey: previous?.objectKey ?? null,
    };
  });
}

export async function listUserDocuments(userId: string) {
  return prisma.userDocument.findMany({
    where: { userId },
    orderBy: { type: "asc" },
  });
}

export async function findUserDocument(
  userId: string,
  type: UserDocumentType,
) {
  return prisma.userDocument.findUnique({
    where: {
      userId_type: {
        userId,
        type,
      },
    },
  });
}

export async function deleteUserDocument(
  userId: string,
  type: UserDocumentType,
) {
  return prisma.$transaction(async (tx) => {
    await lockDocumentType(tx, userId, type);

    const existing = await tx.userDocument.findUnique({
      where: {
        userId_type: {
          userId,
          type,
        },
      },
    });

    if (!existing) {
      return null;
    }

    await tx.userDocument.delete({
      where: {
        userId_type: {
          userId,
          type,
        },
      },
    });

    return existing;
  });
}
