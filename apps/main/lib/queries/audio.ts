import "server-only";

import prisma from "@quazom-ai/db";
import type { AudioSourceKind } from "@quazom-ai/db/enums";

import {
  generateSpeech,
  ttsContextKey,
  TTS_MAX_INPUT_CHARS,
  DEFAULT_TTS_VOICE,
} from "@/lib/tts";
import { putObject, r2IsConfigured } from "@/lib/r2";
import { recordAiUsage } from "@/inngest/ai-usage";

/**
 * Server-side data layer for the audio library. Owns the
 * generate-or-fetch dedup logic, the R2 upload, and the bookkeeping
 * around the GeneratedAudio + AudioPlaylistItem tables. The route
 * handler (`/api/tts`) and the tRPC procedures both go through here so
 * the cache key + storage layout stay in lock-step.
 */

export type AudioSourceInput = {
  kind: AudioSourceKind;
  /** Display title shown in the audio bar (e.g. lesson/resource title). */
  title: string;
  /** Optional sub-section label appended after the title ("Overview"). */
  section?: string | null;
  /** Optional source FK. We Set-Null on cascade so a deleted lesson
   *  doesn't drop the audio from the library. */
  lessonId?: string | null;
  curriculumId?: string | null;
  resourceId?: string | null;
};

export type GeneratedAudioSummary = {
  id: string;
  title: string;
  section: string | null;
  sourceKind: AudioSourceKind;
  lessonId: string | null;
  curriculumId: string | null;
  resourceId: string | null;
  audioBytes: number;
  durationSeconds: number | null;
  characterCount: number;
  truncated: boolean;
  voice: string;
  createdAt: Date;
};

const AUDIO_SUMMARY_SELECT = {
  id: true,
  title: true,
  section: true,
  sourceKind: true,
  lessonId: true,
  curriculumId: true,
  resourceId: true,
  audioBytes: true,
  durationSeconds: true,
  characterCount: true,
  truncated: true,
  voice: true,
  createdAt: true,
} as const;

/**
 * Look up an existing GeneratedAudio for this user that matches the
 * passed (text, voice, model) tuple, or generate + persist a new one.
 *
 * Dedupe key is `(userId, contextKey)` — clicking "Speak text" on the
 * same passage twice always returns the same row, regardless of how
 * many times the page is reloaded.
 *
 * Throws plain `Error` on misconfiguration / generation failure so
 * route handlers can surface the message verbatim.
 */
export async function generateOrFetchAudio({
  userId,
  text,
  voice,
  source,
}: {
  userId: string;
  text: string;
  voice?: string;
  source: AudioSourceInput;
}): Promise<GeneratedAudioSummary> {
  if (!text || !text.trim()) {
    throw new Error("Nothing to read aloud.");
  }
  if (!r2IsConfigured()) {
    throw new Error(
      "Audio storage is not configured on this server. Set R2_* env vars to enable persistent audio.",
    );
  }

  const finalVoice = voice || DEFAULT_TTS_VOICE;
  const contextKey = ttsContextKey({ text, voice: finalVoice });

  // Existing clip: short-circuit. We refresh the FK columns + display
  // title in case the user re-pinned the audio against a different
  // lesson/resource since last time, but otherwise we never touch R2.
  const existing = await prisma.generatedAudio.findUnique({
    where: { userId_contextKey: { userId, contextKey } },
    select: AUDIO_SUMMARY_SELECT,
  });
  if (existing) {
    // Update the source metadata in case a callsite changed (e.g. the
    // text moved to a different lesson). We only write when something
    // actually differs to avoid unnecessary updatedAt churn.
    const needsUpdate =
      existing.title !== source.title ||
      (existing.section ?? null) !== (source.section ?? null) ||
      existing.sourceKind !== source.kind ||
      (existing.lessonId ?? null) !== (source.lessonId ?? null) ||
      (existing.curriculumId ?? null) !== (source.curriculumId ?? null) ||
      (existing.resourceId ?? null) !== (source.resourceId ?? null);
    if (needsUpdate) {
      const updated = await prisma.generatedAudio.update({
        where: { id: existing.id },
        data: {
          title: source.title,
          section: source.section ?? null,
          sourceKind: source.kind,
          lessonId: source.lessonId ?? null,
          curriculumId: source.curriculumId ?? null,
          resourceId: source.resourceId ?? null,
        },
        select: AUDIO_SUMMARY_SELECT,
      });
      return updated;
    }
    return existing;
  }

  // Cache miss → call Gemini. We don't pre-allocate the row — if Gemini
  // fails or R2 rejects the upload we'd be stuck cleaning up later. The
  // create happens last, after both side effects have committed.
  const result = await generateSpeech({ text, voice: finalVoice });

  const audioId = crypto.randomUUID();
  const audioKey = `users/${userId}/audio/${audioId}.wav`;
  await putObject({
    key: audioKey,
    body: result.wav,
    contentType: "audio/wav",
  });

  const created = await prisma.generatedAudio.create({
    data: {
      id: audioId,
      userId,
      contextKey,
      voice: finalVoice,
      model: result.model,
      sourceKind: source.kind,
      lessonId: source.lessonId ?? null,
      curriculumId: source.curriculumId ?? null,
      resourceId: source.resourceId ?? null,
      title: source.title,
      section: source.section ?? null,
      audioKey,
      audioMimeType: "audio/wav",
      audioBytes: result.wav.length,
      durationSeconds: result.durationSeconds,
      characterCount: result.spokenChars,
      truncated: result.truncated,
    },
    select: AUDIO_SUMMARY_SELECT,
  });

  // Record best-effort token usage for the admin dashboard.
  void recordAiUsage({
    userId,
    kind: "TTS",
    model: result.model,
    result: { usage: result.usage },
    resourceId: audioId,
  });

  return created;
}

/** Sentinel char count beyond which the server-side TTS will truncate. */
export const AUDIO_MAX_INPUT_CHARS = TTS_MAX_INPUT_CHARS;

export async function listGeneratedAudiosForUser(
  userId: string,
): Promise<GeneratedAudioSummary[]> {
  return prisma.generatedAudio.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: AUDIO_SUMMARY_SELECT,
  });
}

export type AudioPlaylistRow = GeneratedAudioSummary & {
  position: number;
};

/**
 * Read the user's playlist as an ordered list of audio summaries. The
 * caller doesn't need to know about the join row — they just see the
 * audios in playback order.
 */
export async function getAudioPlaylistForUser(
  userId: string,
): Promise<AudioPlaylistRow[]> {
  const items = await prisma.audioPlaylistItem.findMany({
    where: { userId },
    orderBy: { position: "asc" },
    include: { audio: { select: AUDIO_SUMMARY_SELECT } },
  });
  return items.map((item) => ({
    ...item.audio,
    position: item.position,
  }));
}
