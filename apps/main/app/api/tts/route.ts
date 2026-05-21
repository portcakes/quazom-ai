import { headers as nextHeaders } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  AUDIO_MAX_INPUT_CHARS,
  generateOrFetchAudio,
  type AudioSourceInput,
} from "@/lib/queries/audio";

// TTS generation is dynamic on every request and can't be cached.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Wider than the model's hard cap so a slightly oversized passage falls
// through to the server-side truncation in `generateSpeech` instead of
// being rejected here. Practical safety net against absurdly large
// payloads (paste-bomb attacks against the API).
const MAX_INCOMING_TEXT = 200_000;

const sourceSchema = z.object({
  kind: z.enum([
    "LESSON_OVERVIEW",
    "LESSON_READING",
    "LESSON_VIDEO_OVERVIEW",
    "LESSON_QUIZ_OVERVIEW",
    "LESSON_QUIZ_READING",
    "RESOURCE_READER",
    "CURRICULUM_OVERVIEW",
    "COURSE_OBJECTIVES",
    "GENERIC",
  ]),
  title: z.string().min(1).max(300),
  section: z.string().max(120).nullable().optional(),
  lessonId: z.string().nullable().optional(),
  curriculumId: z.string().nullable().optional(),
  resourceId: z.string().nullable().optional(),
});

const requestSchema = z.object({
  text: z.string().min(1).max(MAX_INCOMING_TEXT),
  voice: z.string().min(1).max(64).optional(),
  source: sourceSchema,
});

/**
 * POST /api/tts
 *
 * Generate (or look up) a synthesised audio clip for the given passage,
 * persist the WAV to R2 + a `GeneratedAudio` row, and return a JSON
 * summary the client can hand to the global audio player. The actual
 * audio bytes are served via `/api/audio/[id]/stream` so the caller can
 * use `<audio>`'s native progressive download / range support.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: z.infer<typeof requestSchema>;
  try {
    const body: unknown = await request.json();
    parsed = requestSchema.parse(body);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invalid request body";
    return Response.json({ error: message }, { status: 400 });
  }

  const source: AudioSourceInput = {
    kind: parsed.source.kind,
    title: parsed.source.title,
    section: parsed.source.section ?? null,
    lessonId: parsed.source.lessonId ?? null,
    curriculumId: parsed.source.curriculumId ?? null,
    resourceId: parsed.source.resourceId ?? null,
  };

  try {
    const audio = await generateOrFetchAudio({
      userId: session.user.id,
      text: parsed.text,
      voice: parsed.voice,
      source,
    });
    return Response.json(
      {
        audio: {
          id: audio.id,
          title: audio.title,
          section: audio.section,
          sourceKind: audio.sourceKind,
          lessonId: audio.lessonId,
          curriculumId: audio.curriculumId,
          resourceId: audio.resourceId,
          audioBytes: audio.audioBytes,
          durationSeconds: audio.durationSeconds,
          characterCount: audio.characterCount,
          truncated: audio.truncated,
          voice: audio.voice,
          createdAt: audio.createdAt.toISOString(),
          streamUrl: `/api/audio/${audio.id}/stream`,
        },
        maxInputChars: AUDIO_MAX_INPUT_CHARS,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[tts] failed to generate or fetch audio", err);
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Failed to generate audio.";
    return Response.json({ error: message }, { status: 502 });
  }
}
