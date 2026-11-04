import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOAD_URL_EXPIRY_SECONDS = 300;

let s3Client: S3Client | undefined;

function getS3Configuration() {
  const region = process.env.AWS_REGION?.trim();
  const bucketName = process.env.AWS_S3_BUCKET_NAME?.trim();

  if (!region || !bucketName) {
    throw new Error(
      "AWS_REGION and AWS_S3_BUCKET_NAME must be configured.",
    );
  }

  return {
    region,
    bucketName,
  };
}

function getS3Client(): S3Client {
  const { region } = getS3Configuration();

  if (!s3Client) {
    s3Client = new S3Client({
      region,
      maxAttempts: 3,
    });
  }

  return s3Client;
}

/**
 * Generate a short-lived presigned URL for uploading a document.
 *
 * The browser must use the same Content-Type header when uploading.
 */
export async function createDocumentUploadUrl({
  key,
  contentType,
}: {
  key: string;
  contentType: string;
}): Promise<string> {
  const { bucketName } = getS3Configuration();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(getS3Client(), command, {
    expiresIn: UPLOAD_URL_EXPIRY_SECONDS,
    signableHeaders: new Set(["content-type"]),
  });
}


/**
 * Retrieve object metadata without downloading the file.
 */
export async function getDocumentObjectMetadata(key: string) {
  const { bucketName } = getS3Configuration();

  const result = await getS3Client().send(
    new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );

  return {
    contentType: result.ContentType ?? null,
    contentLength: result.ContentLength ?? null,
    lastModified: result.LastModified ?? null,
  };
}

/**
 * Download an object for server-side file signature validation.
 *
 * The calling code must check the object's size before downloading it.
 */
export async function getDocumentObjectBytes(
  key: string,
): Promise<Buffer> {
  const { bucketName } = getS3Configuration();

  const result = await getS3Client().send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );

  if (!result.Body) {
    throw new Error("The requested S3 object has no response body.");
  }

  const bytes = await result.Body.transformToByteArray();

  return Buffer.from(bytes);
}

/**
 * Permanently delete a document object from S3.
 */
export async function deleteDocumentObject(key: string): Promise<void> {
  const { bucketName } = getS3Configuration();

  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
}