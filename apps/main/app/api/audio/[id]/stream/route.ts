import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@quazom-ai/db";
import { r2IsConfigured, streamObject } from "@/lib/r2";

// Streaming binary audio out of R2 — never prerender, never cache the
// route handler shell.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Same-origin stream of a `GeneratedAudio` clip from R2. The browser
 * mounts this URL directly on the global `<audio>` element so it can
 * use native progressive download. We set strong cache headers because
 * the WAV is immutable — once a clip exists, its bytes never change.
 *
 * Auth: the audio's `userId` must match the session user. We don't mint
 * signed R2 URLs because the route handler proxies the bytes through
 * Next, which gives us free same-origin behaviour and keeps the R2
 * credentials server-side.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await ctx.params;

  const audio = await prisma.generatedAudio.findFirst({
    where: { id, userId: session.user.id },
    select: {
      audioKey: true,
      audioMimeType: true,
      audioBytes: true,
    },
  });
  if (!audio) {
    return new Response("Not found", { status: 404 });
  }
  if (!r2IsConfigured()) {
    return new Response("Audio storage is not configured.", { status: 500 });
  }

  let object;
  try {
    object = await streamObject(audio.audioKey);
  } catch (err) {
    console.error("[audio/stream] R2 read failed", err);
    return new Response("Audio currently unavailable", { status: 502 });
  }
  if (!object) {
    return new Response("Audio object missing in storage", { status: 410 });
  }

  const headers = new Headers({
    "Content-Type": object.contentType ?? audio.audioMimeType,
    "Cache-Control": "private, max-age=86400, immutable",
    // Hint to clients that we'd like to support seeking.
    "Accept-Ranges": "bytes",
  });
  if (object.contentLength != null) {
    headers.set("Content-Length", String(object.contentLength));
  } else {
    headers.set("Content-Length", String(audio.audioBytes));
  }
  if (object.etag) {
    headers.set("ETag", object.etag);
  }

  return new Response(object.stream, { status: 200, headers });
}
