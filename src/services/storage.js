import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "any",
    secretAccessKey: process.env.S3_SECRET_KEY || "any",
  },
  forcePathStyle: true, // Required for SeaweedFS/MinIO
});

const BUCKET_NAME = process.env.S3_BUCKET || "student-photos";

/**
 * Ensure bucket exists, create if not
 */
export async function ensureBucket() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`[S3] Bucket "${BUCKET_NAME}" exists`);
  } catch (error) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      console.log(`[S3] Creating bucket "${BUCKET_NAME}"...`);
      await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      console.log(`[S3] Bucket "${BUCKET_NAME}" created`);
    } else {
      console.error("[S3] Error checking bucket:", error.message);
    }
  }
}

/**
 * Upload file to S3
 * @param {Buffer} fileBuffer - File content
 * @param {string} originalName - Original filename
 * @param {string} mimeType - File MIME type
 * @returns {Promise<string>} - S3 key
 */
export async function uploadFile(fileBuffer, originalName, mimeType) {
  const ext = originalName.split(".").pop();
  const key = `uploads/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);
  return key;
}

/**
 * Delete file from S3
 * @param {string} key - S3 key
 */
export async function deleteFile(key) {
  if (!key) return;

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  try {
    await s3Client.send(command);
    console.log(`[S3] Deleted: ${key}`);
  } catch (error) {
    console.error(`[S3] Error deleting ${key}:`, error.message);
  }
}

/**
 * Get file from S3 as stream
 * @param {string} key - S3 key
 * @returns {Promise<{stream: ReadableStream, contentType: string}>}
 */
export async function getFile(key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  return {
    stream: response.Body,
    contentType: response.ContentType,
  };
}

/**
 * Generate signed URL for file
 * @param {string} key - S3 key
 * @param {number} expiresIn - Expiration in seconds (default: 1 hour)
 * @returns {Promise<string>}
 */
export async function getSignedFileUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

export { s3Client, BUCKET_NAME };
