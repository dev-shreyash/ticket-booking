import { z } from "zod";

export const DOCUMENT_TYPES = [
  "PROFILE_PHOTO",
  "ID_CARD",
] as const;

export type UserDocumentType = (typeof DOCUMENT_TYPES)[number];

export const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;

export const DOCUMENT_TYPE_LABELS: Record<UserDocumentType, string> = {
  PROFILE_PHOTO: "Photograph",
  ID_CARD: "ID Card",
};

const ALLOWED_CONTENT_TYPES = {
  PROFILE_PHOTO: [
    "image/jpeg",
    "image/png",
    "image/webp",
  ],
  ID_CARD: [
    "image/jpeg",
    "image/png",
    "application/pdf",
  ],
} as const;

const FILE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const documentTypeSchema = z.enum(DOCUMENT_TYPES);

const documentMetadataSchema = z.object({
  type: documentTypeSchema,

  fileName: z
    .string()
    .trim()
    .min(1, "File name is required.")
    .max(255, "File name cannot exceed 255 characters."),

  contentType: z
    .string()
    .trim()
    .min(1, "Content type is required.")
    .max(100),

  fileSize: z
    .number()
    .int()
    .positive("File cannot be empty.")
    .max(
      MAX_DOCUMENT_SIZE_BYTES,
      "File cannot exceed 5 MB.",
    ),
});

export const documentPresignSchema =
  documentMetadataSchema.strict().superRefine((data, context) => {
    if (!isAllowedDocumentContentType(data.type, data.contentType)) {
      context.addIssue({
        code: "custom",
        path: ["contentType"],
        message: `Unsupported file format for ${DOCUMENT_TYPE_LABELS[data.type]}.`,
      });
    }
  });

export const documentCompleteSchema = z.object({
  ...documentMetadataSchema.shape,

  objectKey: z
    .string()
    .min(1)
    .max(500),
}).strict().superRefine((data, context) => {
  if (!isAllowedDocumentContentType(data.type, data.contentType)) {
    context.addIssue({
      code: "custom",
      path: ["contentType"],
      message: `Unsupported file format for ${DOCUMENT_TYPE_LABELS[data.type]}.`,
    });
  }
});

export type DocumentPresignInput = z.infer<
  typeof documentPresignSchema
>;

export type DocumentCompleteInput = z.infer<
  typeof documentCompleteSchema
>;

export function isAllowedDocumentContentType(
  type: UserDocumentType,
  contentType: string,
): boolean {
  return (
    ALLOWED_CONTENT_TYPES[type] as readonly string[]
  ).includes(contentType);
}

/**
 * Convert the original MIME type to a safe file extension.
 */
export function getDocumentExtension(contentType: string): string {
  const extension = FILE_EXTENSIONS[contentType];

  if (!extension) {
    throw new Error("Unsupported document content type.");
  }

  return extension;
}

/**
 * Store a sanitized original filename as metadata.
 *
 * The filename is never used as the S3 object key.
 */
export function sanitizeDocumentFileName(
  fileName: string,
): string {
  const lastSegment = fileName
    .replace(/\\/g, "/")
    .split("/")
    .pop() ?? "";

  const sanitized = lastSegment
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .replace(/^[. ]+|[. ]+$/g, "")
    .slice(0, 255);

  return sanitized || "document";
}

/**
 * Validate the actual file signature instead of trusting
 * the browser-provided MIME type alone.
 */
export function hasValidDocumentSignature(
  bytes: Uint8Array,
  contentType: string,
): boolean {
  const buffer = Buffer.from(bytes);

  switch (contentType) {
    case "image/jpeg":
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );

    case "image/png":
      return (
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(
          Buffer.from([
            0x89,
            0x50,
            0x4e,
            0x47,
            0x0d,
            0x0a,
            0x1a,
            0x0a,
          ]),
        )
      );

    case "image/webp":
      return (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
      );

    case "application/pdf":
      return (
        buffer.length >= 5 &&
        buffer.toString("ascii", 0, 5) === "%PDF-"
      );

    default:
      return false;
  }
}