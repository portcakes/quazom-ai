"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2Icon, Volume2Icon } from "lucide-react";
import type { AudioSourceKind } from "@quazom-ai/db/enums";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { cn } from "@quazom-ai/ui/lib/utils";
import { useTRPC } from "@/trpc/client";
import {
  useAudioPlayer,
  type AudioTrack,
} from "@/components/features/audio-player/audio-player-provider";

/**
 * Discriminated union for "where did this passage come from?" — the
 * server uses it to set the `sourceKind` + FK columns on the
 * `GeneratedAudio` row, which lets the audio bar render a meaningful
 * sub-label and the library group clips by source.
 *
 * Adding a new variant:
 *   1. Append the literal `kind` to the union below.
 *   2. Mirror it in the `AudioSourceKind` Prisma enum (+ migration).
 *   3. Map it to a display string in `audio-player-bar.tsx`.
 */
export type SpeakSource =
  | {
      kind: "lesson-overview";
      lessonId: string;
      lessonTitle: string;
      curriculumId?: string | null;
    }
  | {
      kind: "lesson-reading";
      lessonId: string;
      lessonTitle: string;
      curriculumId?: string | null;
    }
  | {
      kind: "lesson-video-overview";
      lessonId: string;
      lessonTitle: string;
      curriculumId?: string | null;
    }
  | {
      kind: "lesson-quiz-overview";
      lessonId: string;
      lessonTitle: string;
      curriculumId?: string | null;
    }
  | {
      kind: "lesson-quiz-reading";
      lessonId: string;
      lessonTitle: string;
      curriculumId?: string | null;
    }
  | {
      kind: "resource-reader";
      resourceId: string;
      resourceTitle: string;
    }
  | {
      kind: "curriculum-overview";
      curriculumId: string;
      curriculumTitle: string;
    }
  | {
      kind: "course-objectives";
      curriculumId: string;
      curriculumTitle: string;
    };

type Props = {
  /** Markdown-tolerant text to read aloud. The server strips formatting
   *  before sending to Gemini, so passing the raw passage is fine. */
  text: string;
  /** Provenance metadata. Drives the audio's display title + DB FKs. */
  source: SpeakSource;
  /** Visible button label. Defaults to "Speak text". */
  label?: string;
  /** Tailwind classes layered onto the wrapper. */
  className?: string;
  /** Visual size of the button. */
  size?: "xs" | "sm" | "default";
  /** Visual variant of the button. */
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** Override the prebuilt voice name. See
   *  https://ai.google.dev/gemini-api/docs/speech-generation#voices. */
  voice?: string;
};

type ApiResponse =
  | {
      audio: {
        id: string;
        title: string;
        section: string | null;
        sourceKind: AudioSourceKind;
        lessonId: string | null;
        curriculumId: string | null;
        resourceId: string | null;
        durationSeconds: number | null;
        characterCount: number;
        truncated: boolean;
        voice: string;
        streamUrl: string;
      };
      maxInputChars?: number;
    }
  | { error: string };

/**
 * Quick-access "Speak text" affordance. Generates (or fetches) the
 * audio for the passed text on the server, then hands the result off to
 * the global `<AudioPlayerProvider>` so playback happens in the sticky
 * bar at the top of the app — not inline in the page. Once a passage
 * has been generated, subsequent clicks return instantly because the
 * server dedupes on a SHA-256 of (text, voice, model).
 */
export function SpeakTextButton({
  text,
  source,
  label = "Speak text",
  className,
  size = "sm",
  variant = "outline",
  voice,
}: Props) {
  const player = useAudioPlayer();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (loading) return;
    if (!text.trim()) {
      toast.error("Nothing to read aloud yet.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice,
          source: toApiSource(source),
        }),
      });
      const json = (await response.json().catch(() => null)) as
        | ApiResponse
        | null;
      if (!response.ok || !json || "error" in json) {
        const message =
          (json && "error" in json && typeof json.error === "string"
            ? json.error
            : null) ?? `Couldn't generate audio (${response.status})`;
        throw new Error(message);
      }

      const track: AudioTrack = {
        id: json.audio.id,
        title: json.audio.title,
        section: json.audio.section,
        sourceKind: json.audio.sourceKind,
        lessonId: json.audio.lessonId,
        curriculumId: json.audio.curriculumId,
        resourceId: json.audio.resourceId,
        durationSeconds: json.audio.durationSeconds,
        voice: json.audio.voice,
        truncated: json.audio.truncated,
        characterCount: json.audio.characterCount,
      };

      // Refresh the library + playlist queries so the bar's dropdowns
      // pick up the new clip without waiting for staleTime to elapse.
      void queryClient.invalidateQueries({
        queryKey: trpc.listGeneratedAudios.queryKey(),
      });

      player.play(track);

      if (json.audio.truncated) {
        const max = json.maxInputChars
          ? `${json.maxInputChars}`
          : "the maximum";
        toast.info(`This passage is long — reading the first ${max} characters.`);
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Couldn't generate audio.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [loading, text, voice, source, queryClient, trpc, player]);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <Button
        type="button"
        size={size}
        variant={variant}
        className="cursor-pointer"
        disabled={loading || !text.trim()}
        onClick={handleClick}
      >
        {loading ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : (
          <Volume2Icon className="size-3.5" />
        )}
        {loading ? "Generating…" : label}
      </Button>
    </div>
  );
}

// --------------------------------------------------------------------
// Mapping client-side `SpeakSource` to the wire shape the API expects.
// Lives here (not on the server) so the UI is the single source of
// truth for what each kind means; the server only validates the result.
// --------------------------------------------------------------------

type ApiSource = {
  kind: AudioSourceKind;
  title: string;
  section: string | null;
  lessonId: string | null;
  curriculumId: string | null;
  resourceId: string | null;
};

function toApiSource(source: SpeakSource): ApiSource {
  switch (source.kind) {
    case "lesson-overview":
      return {
        kind: "LESSON_OVERVIEW",
        title: source.lessonTitle,
        section: "Overview",
        lessonId: source.lessonId,
        curriculumId: source.curriculumId ?? null,
        resourceId: null,
      };
    case "lesson-reading":
      return {
        kind: "LESSON_READING",
        title: source.lessonTitle,
        section: "Reading",
        lessonId: source.lessonId,
        curriculumId: source.curriculumId ?? null,
        resourceId: null,
      };
    case "lesson-video-overview":
      return {
        kind: "LESSON_VIDEO_OVERVIEW",
        title: source.lessonTitle,
        section: "Overview",
        lessonId: source.lessonId,
        curriculumId: source.curriculumId ?? null,
        resourceId: null,
      };
    case "lesson-quiz-overview":
      return {
        kind: "LESSON_QUIZ_OVERVIEW",
        title: source.lessonTitle,
        section: "Overview",
        lessonId: source.lessonId,
        curriculumId: source.curriculumId ?? null,
        resourceId: null,
      };
    case "lesson-quiz-reading":
      return {
        kind: "LESSON_QUIZ_READING",
        title: source.lessonTitle,
        section: "Reading",
        lessonId: source.lessonId,
        curriculumId: source.curriculumId ?? null,
        resourceId: null,
      };
    case "resource-reader":
      return {
        kind: "RESOURCE_READER",
        title: source.resourceTitle,
        section: null,
        lessonId: null,
        curriculumId: null,
        resourceId: source.resourceId,
      };
    case "curriculum-overview":
      return {
        kind: "CURRICULUM_OVERVIEW",
        title: source.curriculumTitle,
        section: "Overview",
        lessonId: null,
        curriculumId: source.curriculumId,
        resourceId: null,
      };
    case "course-objectives":
      return {
        kind: "COURSE_OBJECTIVES",
        title: source.curriculumTitle,
        section: "Course Objectives",
        lessonId: null,
        curriculumId: source.curriculumId,
        resourceId: null,
      };
  }
}
