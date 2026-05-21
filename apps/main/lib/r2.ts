import "server-only";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 is S3-API-compatible. The SDK only needs the account-scoped
// endpoint, an access key pair, and a bucket name. We keep the client lazy
// so missing env vars surface as a clear error at first use (e.g. on the
// /resources upload flow) rather than blowing up module import for any page
// that happens to touch this file.
//
// Required env vars (see apps/main/.env.example or AGENTS.md for setup):
//   R2_ACCOUNT_ID         — the 32-char hex account id from your Cloudflare dashboard
//   R2_ACCESS_KEY_ID      — R2 token "Access Key ID"
//   R2_SECRET_ACCESS_KEY  — R2 token "Secret Access Key"
//   R2_BUCKET             — name of the bucket holding the resource objects
//   R2_PUBLIC_URL         — optional. When set, the viewer can render a same-
//                           origin URL instead of minting a signed GET on every
//                           render. Useful for PDFs in iframes.

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string | null;
};

let cachedClient: S3Client | null = null;
let cachedConfig: R2Config | null = null;

function readConfig(): R2Config {
  if (cachedConfig) return cachedConfig;
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET in your environment before uploading or downloading resources.",
    );
  }
  const publicUrl = process.env.R2_PUBLIC_URL?.trim()
    ? process.env.R2_PUBLIC_URL!.trim().replace(/\/+$/, "")
    : null;
  cachedConfig = {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicUrl,
  };
  return cachedConfig;
}

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  const cfg = readConfig();
  cachedClient = new S3Client({
    // R2 is region-less but the SDK requires a value; "auto" is the
    // Cloudflare-recommended placeholder.
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return cachedClient;
}

export function r2IsConfigured(): boolean {
  try {
    readConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Mint a one-shot signed PUT URL the client can use to upload a file
 * directly to R2 without it transiting our server. The URL is valid for
 * the duration passed in (default 5 minutes) and refuses content of a
 * different type/size than we expect.
 */
export async function getSignedUploadUrl(opts: {
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number;
}): Promise<string> {
  const { bucket } = readConfig();
  const client = getClient();
  return await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: opts.key,
      ContentType: opts.contentType,
      ContentLength: opts.contentLength,
    }),
    { expiresIn: opts.expiresInSeconds ?? 300 },
  );
}

/**
 * Mint a signed GET URL the viewer can hand to an iframe / `<embed>`. R2
 * doesn't support range requests on signed URLs reliably across all SDKs,
 * so we keep the default duration short (5 minutes) and let the client
 * refresh if the user keeps the page open.
 */
export async function getSignedDownloadUrl(opts: {
  key: string;
  expiresInSeconds?: number;
  filename?: string;
}): Promise<string> {
  const { bucket } = readConfig();
  const client = getClient();
  return await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: opts.key,
      // Force a sensible download filename when the browser saves the file.
      ResponseContentDisposition: opts.filename
        ? `inline; filename="${escapeDispositionFilename(opts.filename)}"`
        : undefined,
    }),
    { expiresIn: opts.expiresInSeconds ?? 300 },
  );
}

/** HEAD the object so we can verify the upload actually succeeded. */
export async function headObject(key: string): Promise<{
  exists: boolean;
  size: number | null;
  contentType: string | null;
}> {
  const { bucket } = readConfig();
  const client = getClient();
  try {
    const res = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    return {
      exists: true,
      size: res.ContentLength ?? null,
      contentType: res.ContentType ?? null,
    };
  } catch (err) {
    // 404 → not uploaded yet; other errors bubble.
    if ((err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) {
      return { exists: false, size: null, contentType: null };
    }
    throw err;
  }
}

/** Read the object body into a UTF-8 string (used for TXT/MD extraction). */
export async function getObjectText(key: string): Promise<string> {
  const { bucket } = readConfig();
  const client = getClient();
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!res.Body) return "";
  const stream = res.Body as unknown as {
    transformToString: (encoding?: string) => Promise<string>;
  };
  return await stream.transformToString("utf-8");
}

/**
 * Read the object body as raw bytes (used for PDF text extraction — pdf.js
 * needs the whole buffer up-front because it parses xref tables backwards).
 * Returns `null` if the object isn't in the bucket.
 */
export async function getObjectBytes(
  key: string,
): Promise<Uint8Array | null> {
  const { bucket } = readConfig();
  const client = getClient();
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (!res.Body) return null;
    const body = res.Body as unknown as {
      transformToByteArray: () => Promise<Uint8Array>;
    };
    return await body.transformToByteArray();
  } catch (err) {
    if (
      (err as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode === 404
    ) {
      return null;
    }
    throw err;
  }
}

export type R2ObjectStream = {
  stream: ReadableStream<Uint8Array>;
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
};

/**
 * GET the object body as a Web ReadableStream so a Next.js route handler can
 * pipe it straight back to the browser. Returns `null` if the object isn't
 * in the bucket (so callers can answer with a clean 404).
 */
export async function streamObject(key: string): Promise<R2ObjectStream | null> {
  const { bucket } = readConfig();
  const client = getClient();
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (!res.Body) return null;
    // The SDK's SdkStream mixin exposes transformToWebStream on every
    // runtime — Node converts an underlying Readable, browsers/edge return
    // the native Fetch stream. Either way the caller gets a standard
    // ReadableStream they can hand to `new Response(...)`.
    const body = res.Body as unknown as {
      transformToWebStream: () => ReadableStream<Uint8Array>;
    };
    return {
      stream: body.transformToWebStream(),
      contentType: res.ContentType ?? null,
      contentLength: res.ContentLength ?? null,
      etag: res.ETag ?? null,
    };
  } catch (err) {
    if (
      (err as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode === 404
    ) {
      return null;
    }
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const { bucket } = readConfig();
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Server-to-R2 upload — used when the bytes are produced server-side and we
 * never want them to transit the client. The TTS pipeline takes this path:
 * Gemini hands us PCM, we wrap it in a WAV header in-process, then PUT to
 * R2 directly without minting a signed upload URL.
 *
 * `body` accepts either `Buffer` or `Uint8Array`; both serialise to a
 * Node `Readable` under the hood. ContentLength must match the buffer
 * length so R2's S3 layer accepts the request.
 */
export async function putObject(opts: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<void> {
  const { bucket } = readConfig();
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType,
      ContentLength: opts.body.byteLength,
    }),
  );
}

function escapeDispositionFilename(name: string): string {
  // RFC 6266 leaves us with a simple "strip backslashes / quotes" job for
  // the legacy `filename=` form. We'll never exceed the basic ASCII set
  // because the API tolerates non-ASCII originals (they're allowed via
  // `filename*=utf-8''…`, but it's not worth complicating the signed URL).
  return name.replace(/[\\"\n\r]/g, "_");
}
