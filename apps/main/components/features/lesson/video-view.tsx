"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CheckIcon, ExternalLinkIcon } from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { useTRPC } from "@/trpc/client";
import type { LessonDetail } from "@/lib/queries/lesson";

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

  const embedUrl = toEmbeddable(video.embedUrl);
  const externalUrl = video.externalUrl || video.embedUrl;

  return (
    <div className="flex flex-col gap-8">
      {video.overview ? (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-5">
          <h2 className="font-heading text-lg font-semibold">Overview</h2>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {video.overview}
          </div>
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
      ) : externalUrl ? (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center hover:bg-card/70"
        >
          <ExternalLinkIcon className="size-5" />
          <span className="font-medium">Watch the video on its source</span>
        </a>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
          No video link was provided. Try regenerating the lesson.
        </div>
      )}

      {externalUrl && embedUrl ? (
        <a
          href={externalUrl}
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
    </div>
  );
}

// Convert common YouTube URL forms to an embeddable iframe URL. Returns null
// for URLs we can't safely embed.
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
      if (url.pathname.startsWith("/embed/")) return rawUrl;
      const id = url.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}
