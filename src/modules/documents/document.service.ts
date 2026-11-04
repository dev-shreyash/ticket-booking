
import { randomUUID } from "node:crypto";

import {
  createDocumentUploadUrl,
  createDocumentViewUrl,
  deleteDocumentObject,
  getDocumentObjectBytes,
  getDocumentObjectMetadata,
} from "@/lib/s3";

import {
  getDocumentExtension,
  hasValidDocumentSignature,
  sanitizeDocumentFileName,
} from "@/lib/document-validation";

import type {
  DocumentCompleteInput,
  DocumentPresignInput,
  UserDocumentType,
} from "@/lib/document-validation";

import { AppError } from "@/lib/errors";

import {
  deleteUserDocument,
  listUserDocuments,
  saveUserDocument,
} from "./document.repository";

const UPLOAD_URL_EXPIRY_SECONDS = 300;

function createDocumentObjectKey(
  userId: string,
  type: UserDocumentType,
  contentType: string,
) {
  const extension = getDocumentExtension(contentType);

  return [
    "users",
    userId,
    "documents",
    type,
    `${randomUUID()}.${extension}`,
  ].join("/");
}

/**
 * Only accept UUID-based keys generated for this user's
 * requested document type.
 */
function assertOwnedDocumentObjectKey(
  userId: string,
  type: UserDocumentType,
  objectKey: string,
  contentType: string,
) {
  const prefix = `users/${userId}/documents/${type}/`;
  const fileName = objectKey.startsWith(prefix)
    ? objectKey.slice(prefix.length)
    : "";

  const extension = getDocumentExtension(contentType);

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const keyUuid = fileName.slice(0, -(extension.length + 1));
  const keyExtension = fileName.slice(-(extension.length + 1));

  if (
    !fileName ||
    !uuidPattern.test(keyUuid) ||
    keyExtension !== `.${extension}`
  ) {
    throw new AppError(
      "Invalid document upload reference.",
      "INVALID_DOCUMENT_OBJECT_KEY",
      400,
    );
  }
}

export async function createPresignedDocumentUpload(
  userId: string,
  input: DocumentPresignInput,
) {
  const fileName = sanitizeDocumentFileName(input.fileName);

  const objectKey = createDocumentObjectKey(
    userId,
    input.type,
    input.contentType,
  );

  const uploadUrl = await createDocumentUploadUrl({
    key: objectKey,
    contentType: input.contentType,
  });

  return {
    uploadUrl,
    objectKey,
    fileName,
    expiresInSeconds: UPLOAD_URL_EXPIRY_SECONDS,
    requiredHeaders: {
      "Content-Type": input.contentType,
    },
  };
}

export async function completeDocumentUpload(
  userId: string,
  input: DocumentCompleteInput,
) {
  assertOwnedDocumentObjectKey(
    userId,
    input.type,
    input.objectKey,
    input.contentType,
  );

  let metadata: Awaited<
  ReturnType<typeof getDocumentObjectMetadata>
    >;

  try {
    metadata = await getDocumentObjectMetadata(input.objectKey);
  } catch (error) {
    const errorName =
      typeof error === "object" && error !== null && "name" in error
        ? String(error.name)
        : "";

    if (errorName === "NotFound" || errorName === "NoSuchKey") {
      throw new AppError(
        "The uploaded document could not be found in storage.",
        "DOCUMENT_UPLOAD_NOT_FOUND",
        400,
      );
    }

    throw error;
  }

  if (
    metadata.contentLength === null ||
    metadata.contentLength !== input.fileSize
  ) {
    throw new AppError(
      "The uploaded file size does not match the supplied file information.",
      "DOCUMENT_SIZE_MISMATCH",
      400,
    );
  }

  if (metadata.contentType !== input.contentType) {
    throw new AppError(
      "The uploaded file type does not match the supplied file information.",
      "DOCUMENT_TYPE_MISMATCH",
      400,
    );
  }

  // The size is checked above before downloading the object.
  const bytes = await getDocumentObjectBytes(input.objectKey);

  if (
    bytes.length !== input.fileSize ||
    !hasValidDocumentSignature(bytes, input.contentType)
  ) {
    throw new AppError(
      "The uploaded file does not contain a valid file signature.",
      "INVALID_DOCUMENT_SIGNATURE",
      400,
    );
  }

  const result = await saveUserDocument({
    userId,
    type: input.type,
    objectKey: input.objectKey,
    fileName: sanitizeDocumentFileName(input.fileName),
    contentType: input.contentType,
    fileSize: input.fileSize,
  });

  // The new document is registered before the old object is removed.
  if (
    result.previousObjectKey &&
    result.previousObjectKey !== input.objectKey
  ) {
    try {
      await deleteDocumentObject(result.previousObjectKey);
    } catch (error) {
      // Do not report replacement as failed after the DB commit.
      // The old object can be cleaned up separately.
      console.error(
        "Could not delete replaced document from S3:",
        error,
      );
    }
  }

  const viewUrl = await createDocumentViewUrl({
    key: result.document.objectKey,
    contentType: result.document.contentType,
  });

  return {
    id: result.document.id,
    type: result.document.type,
    fileName: result.document.fileName,
    contentType: result.document.contentType,
    fileSize: result.document.fileSize,
    createdAt: result.document.createdAt.toISOString(),
    updatedAt: result.document.updatedAt.toISOString(),
    viewUrl,
  };
}

export async function getCustomerDocuments(userId: string) {
  const documents = await listUserDocuments(userId);

  return Promise.all(
    documents.map(async (document) => ({
      id: document.id,
      type: document.type,
      fileName: document.fileName,
      contentType: document.contentType,
      fileSize: document.fileSize,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      viewUrl: await createDocumentViewUrl({
        key: document.objectKey,
        contentType: document.contentType,
      }),
    })),
  );
}

export async function removeCustomerDocument(
  userId: string,
  type: UserDocumentType,
) {
  const document = await deleteUserDocument(userId, type);

  if (!document) {
    throw new AppError(
      "The requested document was not found.",
      "DOCUMENT_NOT_FOUND",
      404,
    );
  }

  try {
    await deleteDocumentObject(document.objectKey);
  } catch (error) {
    // The database record is already removed. Log storage cleanup failure.
    console.error("Could not delete document from S3:", error);
  }

  return {
    deleted: true,
    type,
  };
}
