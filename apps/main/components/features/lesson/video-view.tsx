"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CheckIcon, ExternalLinkIcon, PlayCircleIcon, SearchIcon } from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { useTRPC } from "@/trpc/client";
import type { LessonDetail } from "@/lib/queries/lesson";
import { Markdown } from "@/components/shared/markdown";
import { SpeakTextButton } from "@/components/shared/speak-text-button";
import { Highlightable } from "./highlightable";
import { LessonNotesPanel } from "./lesson-notes-panel";

type Props = {
  lesson: LessonDetail;
};

export function VideoView({ lesson }: Props) {
  const video = lesson.video;
  const router = useRouter();
  const trpc = useTRPC();
  const markComplete = useMutation(
    trpc.markVideoComplete.mutationOptions({
      onSuccess: () => router.refresh(),
    }),
  );

  if (!video) {
    return <p className="text-sm text-muted-foreground">No video available.</p>;
  }

  // We may receive any of three shapes from the AI:
  //   - A real embeddable YouTube watch URL → render an inline player.
  //   - A YouTube search URL → no embed, just a "Search on YouTube" CTA.
  //   - An empty embedUrl → build a search URL from the lesson title.
  const embedUrl = toEmbeddable(video.embedUrl);
  const youtubeSearchUrl =
    extractYoutubeSearchUrl(video.externalUrl) ??
    extractYoutubeSearchUrl(video.embedUrl) ??
    buildYoutubeSearchUrl(lesson.title);
  const linkedSourceUrl = video.externalUrl || video.embedUrl || youtubeSearchUrl;

  // The lesson-level recommendedResources are AI-curated alongside the
  // video's search query; surface them as further reading so the learner has
  // structured material to study beyond whatever YouTube returns.
  const furtherReading = lesson.recommendedResources;

  return (
    <Highlightable
      lessonId={lesson.id}
      curriculumId={lesson.module.curriculum.id}
    >
    <div className="flex flex-col gap-8">
      {video.overview ? (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold">Overview</h2>
            <SpeakTextButton text={video.overview} />
          </div>
          <Markdown compact className="text-muted-foreground">
            {video.overview}
          </Markdown>
        </section>
      ) : null}

      {embedUrl ? (
        <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
          <iframe
            src={embedUrl}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      ) : (
        // No embeddable URL — this is the common case because we ask the AI
        // for a YouTube search rather than a specific clip. Surface that
        // honestly instead of pretending there's a curated video to play.
        <section className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-card/40 p-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              <PlayCircleIcon className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="font-heading text-lg font-semibold">
                Watch a video on this topic
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                We don&apos;t pick a single video for you. Open the YouTube search
                below to scan thumbnails and pick the explainer that fits your
                learning style, then come back here when you&apos;re done.
              </p>
            </div>
          </div>
          <a
            href={youtubeSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <SearchIcon className="size-3.5" />
            Search YouTube
            <ExternalLinkIcon className="size-3.5" />
          </a>
        </section>
      )}

      {embedUrl && linkedSourceUrl ? (
        <a
          href={linkedSourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Open on source ↗
        </a>
      ) : null}

      {video.description ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{video.description}</p>
      ) : null}

      {furtherReading.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold">Further reading</h2>
          <p className="text-sm text-muted-foreground">
            Structured material to pair with whatever video you watch.
          </p>
          <ul className="flex flex-col gap-2">
            {furtherReading.map((resource) => (
              <li
                key={`${resource.type}-${resource.title}`}
                className="flex flex-col gap-1 rounded-lg border border-border bg-card/40 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-medium">{resource.title}</h3>
                  <Badge variant="secondary" className="capitalize">
                    {resource.type}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{resource.reason}</p>
                <a
                  href={resourceSearchUrl(resource.type, resource.searchQuery)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <SearchIcon className="size-3" />
                  <span className="truncate">{resource.searchQuery}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant={video.isCompleted ? "outline" : "default"}
          className="cursor-pointer"
          disabled={markComplete.isPending}
          onClick={() =>
            markComplete.mutate({
              videoId: video.id,
              isCompleted: !video.isCompleted,
            })
          }
        >
          <CheckIcon className="size-4" />
          {video.isCompleted ? "Marked as watched" : "Mark as watched"}
        </Button>
      </div>

      <LessonNotesPanel
        lessonId={lesson.id}
        curriculumId={lesson.module.curriculum.id}
      />
    </div>
    </Highlightable>
  );
}

// Convert common YouTube URL forms to an embeddable iframe URL. Returns null
// for URLs we can't safely embed — notably YouTube *search* URLs, which the
// AI is now instructed to emit for video lessons.
function toEmbeddable(rawUrl: string): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    // youtu.be/<id>
    if (url.hostname === "youtu.be") {
      const id = url.pathname.replace(/^\//, "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    // youtube.com/watch?v=<id> or already youtube.com/embed/<id>
    if (url.hostname.includes("youtube.com")) {
      // Search URLs (/results?...) are not embeddable.
      if (url.pathname.startsWith("/results")) return null;
      if (url.pathname.startsWith("/embed/")) return rawUrl;
      const id = url.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}

// Pull the search query out of a YouTube /results URL, returning the same
// URL untouched so we can pass it through to a target=_blank link.
function extractYoutubeSearchUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    if (
      url.hostname.includes("youtube.com") &&
      url.pathname.startsWith("/results")
    ) {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function buildYoutubeSearchUrl(title: string): string {
  const q = encodeURIComponent(title);
  return `https://www.youtube.com/results?search_query=${q}`;
}

// Resources are searched via Google by default, but video-typed resources go
// straight to YouTube so the learner lands on watchable content.
function resourceSearchUrl(type: string, query: string): string {
  const q = encodeURIComponent(query);
  if (type === "video") {
    return `https://www.youtube.com/results?search_query=${q}`;
  }
  return `https://www.google.com/search?q=${q}`;
}
