"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2Icon,
  PauseIcon,
  PlayIcon,
  SquareIcon,
  Volume2Icon,
} from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { cn } from "@quazom-ai/ui/lib/utils";

type Props = {
  /** The text to read aloud. Markdown is allowed; the server strips it
   *  before sending to Gemini so the audio stays clean. */
  text: string;
  /** Display label shown beside the speaker icon. Defaults to "Speak text". */
  label?: string;
  /** Tailwind classes layered onto the wrapper for fine-grained alignment. */
  className?: string;
  /** Visual size of the button. Matches the shared `Button` `size` prop. */
  size?: "xs" | "sm" | "default";
  /** Visual variant of the button. Matches the shared `Button` `variant` prop. */
  variant?: "default" | "outline" | "ghost" | "secondary";
  /**
   * Optional override of the prebuilt voice name. See
   * https://ai.google.dev/gemini-api/docs/speech-generation#voices.
   */
  voice?: string;
  /** Surface a tiny "Truncated to N chars" hint after generation if the
   *  server clipped the text. Defaults to true. */
  showTruncationHint?: boolean;
};

type Phase = "idle" | "loading" | "playing" | "paused" | "error";

/**
 * "Speak text" affordance for any reading/overview surface.
 *
 * Click → `POST /api/tts` with the text → receive a WAV blob → play
 * through an off-screen `<audio>` element. While audio is loaded the
 * button morphs into a Pause/Resume + Stop pair so the user can scrub
 * naturally without re-fetching the audio.
 *
 * Each instance owns exactly one `<audio>` element + one object URL,
 * cleaned up on unmount and on re-fetch. The component never tries to
 * coordinate playback across multiple buttons — if a user starts a
 * second button mid-playback the browser will simply play both, which
 * matches what `<audio>` does anywhere else.
 */
export function SpeakTextButton({
  text,
  label = "Speak text",
  className,
  size = "sm",
  variant = "outline",
  voice,
  showTruncationHint = true,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [hint, setHint] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const cleanupAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      try {
        audio.load();
      } catch {
        // <audio>.load() can throw if the element was never wired to a
        // source. Safe to ignore — we're tearing it down anyway.
      }
    }
    audioRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  // If the text the parent renders changes underneath us, any cached
  // audio is stale. We reset visible state during render via the
  // tracked-prop pattern (React's documented technique for derived
  // state) and let the effect below handle the external `<audio>`
  // teardown — calling setState in an effect just to mirror prop
  // changes is exactly what `react-hooks/set-state-in-effect` warns
  // against, and the render-time form has no extra render cost.
  const [trackedText, setTrackedText] = useState(text);
  if (text !== trackedText) {
    setTrackedText(text);
    setPhase("idle");
    setHint(null);
  }

  // Audio teardown is an "external system" sync: the cleanup callback
  // captures the current `audioRef.current` and runs both on unmount
  // and whenever `trackedText` changes (between the old render's
  // cleanup and the new render's effect).
  useEffect(() => {
    return cleanupAudio;
  }, [trackedText, cleanupAudio]);

  const fetchAndPlay = useCallback(async () => {
    if (!text.trim()) {
      toast.error("Nothing to read aloud yet.");
      return;
    }

    setPhase("loading");
    setHint(null);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });
      if (!response.ok) {
        const message = await safeText(response);
        throw new Error(
          message || `Couldn't generate audio (${response.status})`,
        );
      }
      const truncated = response.headers.get("X-TTS-Truncated") === "1";
      const maxChars = response.headers.get("X-TTS-Max-Chars");
      const blob = await response.blob();

      cleanupAudio();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.addEventListener("play", () => setPhase("playing"));
      audio.addEventListener("pause", () => {
        // The "pause" event also fires at the end of playback. Treat
        // end-of-track separately via the "ended" listener below.
        if (!audio.ended) setPhase("paused");
      });
      audio.addEventListener("ended", () => {
        setPhase("idle");
        cleanupAudio();
      });
      audio.addEventListener("error", () => {
        setPhase("error");
        toast.error("Couldn't play the generated audio.");
      });

      if (truncated && showTruncationHint) {
        setHint(
          maxChars
            ? `Reading the first ${maxChars} characters.`
            : "Reading a truncated excerpt.",
        );
      }

      await audio.play();
    } catch (err) {
      cleanupAudio();
      setPhase("error");
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Couldn't generate audio.";
      toast.error(message);
    }
  }, [text, voice, cleanupAudio, showTruncationHint]);

  const togglePause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }, []);

  const stop = useCallback(() => {
    cleanupAudio();
    setPhase("idle");
    setHint(null);
  }, [cleanupAudio]);

  const isLoading = phase === "loading";
  const isPlaying = phase === "playing";
  const isPaused = phase === "paused";
  const hasAudio = isPlaying || isPaused;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      {hasAudio ? (
        <>
          <Button
            type="button"
            size={size}
            variant={variant}
            className="cursor-pointer"
            onClick={togglePause}
          >
            {isPlaying ? (
              <PauseIcon className="size-3.5" />
            ) : (
              <PlayIcon className="size-3.5" />
            )}
            {isPlaying ? "Pause" : "Resume"}
          </Button>
          <Button
            type="button"
            size={size}
            variant="ghost"
            className="cursor-pointer"
            onClick={stop}
            aria-label="Stop audio"
          >
            <SquareIcon className="size-3.5" />
            Stop
          </Button>
        </>
      ) : (
        <Button
          type="button"
          size={size}
          variant={variant}
          className="cursor-pointer"
          disabled={isLoading || !text.trim()}
          onClick={fetchAndPlay}
        >
          {isLoading ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <Volume2Icon className="size-3.5" />
          )}
          {isLoading ? "Generating…" : label}
        </Button>
      )}
      {hint ? <span className="text-[11px]">{hint}</span> : null}
    </div>
  );
}

async function safeText(response: Response): Promise<string | null> {
  try {
    const txt = await response.text();
    return txt.trim() ? txt.trim() : null;
  } catch {
    return null;
  }
}
