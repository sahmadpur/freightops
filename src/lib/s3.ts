import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const endpoint = process.env.S3_ENDPOINT;
const accessKeyId = process.env.S3_ACCESS_KEY;
const secretAccessKey = process.env.S3_SECRET_KEY;
const BUCKET = process.env.S3_BUCKET ?? "freightops-documents";

if (!endpoint || !accessKeyId || !secretAccessKey) {
  throw new Error("S3_ENDPOINT, S3_ACCESS_KEY, and S3_SECRET_KEY are required");
}

/** MinIO needs path-style addressing and a region placeholder. */
export const s3 = new S3Client({
  endpoint,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
});

export const S3_BUCKET = BUCKET;

let bucketReady = false;

/** Create the bucket if it doesn't exist. Idempotent; cached after first success. */
export async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    } catch (err) {
      await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
      void err;
    }
  }
  bucketReady = true;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await ensureBucket();
  await s3.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Fetch an object's bytes and content type for streaming back to the client. */
export async function getObject(key: string): Promise<{ body: Buffer; contentType: string }> {
  await ensureBucket();
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return { body: Buffer.from(bytes), contentType: res.ContentType ?? "application/octet-stream" };
}
