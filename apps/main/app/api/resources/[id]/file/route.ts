import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@quazom-ai/db";
import { streamObject } from "@/lib/r2";

// Streaming an R2 object through a Node route handler is the whole point of
// this file — let Next.js know it's a runtime-only, fully dynamic response
// so it never tries to prerender or cache it.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Same-origin proxy for FILE resources. The viewer's iframe points here
 * instead of at the raw `*.r2.cloudflarestorage.com` signed URL because
 * Cloudflare's S3-API origin is unreliable as an embeddable source —
 * Chrome's PDF viewer regularly refuses to render those URLs and the
 * iframe collapses to `chrome-error://chromewebdata/`, after which any
 * subsequent React re-render trips a same-origin policy error trying to
 * navigate the error frame.
 *
 * By streaming through Next we get:
 *   - A same-origin URL the iframe can navigate to without sandbox quirks.
 *   - Server-controlled Content-Type / Content-Disposition (the upload's
 *     stored type is sometimes `application/octet-stream` which Chrome
 *     refuses to render inline).
 *   - A stable URL that doesn't expire every 10 minutes.
 *   - Auth: only the resource's owner can fetch the bytes.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await ctx.params;

  const resource = await prisma.resource.findFirst({
    where: { id, userId: session.user.id, kind: "FILE" },
    select: {
      fileKey: true,
      fileMimeType: true,
      fileName: true,
      fileSize: true,
      status: true,
    },
  });
  if (!resource || !resource.fileKey) {
    return new Response("Not found", { status: 404 });
  }
  if (resource.status === "PENDING") {
    // Upload hasn't confirmed yet — surface a distinct status so the
    // client can show a "still processing" state instead of a broken file.
    return new Response("Resource not ready", { status: 425 });
  }

  let object: Awaited<ReturnType<typeof streamObject>>;
  try {
    object = await streamObject(resource.fileKey);
  } catch (err) {
    console.error("[resources/file] R2 stream error", err);
    return new Response("Upstream storage error", { status: 502 });
  }
  if (!object) {
    return new Response("File missing", { status: 404 });
  }

  const headers = new Headers();
  // Prefer the MIME we stored at upload time — that's what we already
  // validated against `resourceMimeTypes`. Fall back to R2's stored
  // content-type, then to a safe default.
  headers.set(
    "Content-Type",
    resource.fileMimeType || object.contentType || "application/octet-stream",
  );
  const length = resource.fileSize ?? object.contentLength;
  if (length != null) headers.set("Content-Length", String(length));
  if (object.etag) headers.set("ETag", object.etag);
  if (resource.fileName) {
    const safeName = resource.fileName.replace(/[\\"\n\r]/g, "_");
    headers.set("Content-Disposition", `inline; filename="${safeName}"`);
  }
  // The URL is per-user-scoped (owner-only above), so it's safe to let the
  // browser cache the bytes for the session. Cap it short so a deleted file
  // doesn't linger forever in someone's HTTP cache.
  headers.set("Cache-Control", "private, max-age=600");
  // R2 doesn't always honour Range on signed URLs, but our own proxy can.
  // Advertise that we accept ranges so Chrome's PDF viewer is happy.
  headers.set("Accept-Ranges", "bytes");

  return new Response(object.stream, { status: 200, headers });
}
