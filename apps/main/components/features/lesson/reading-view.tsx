"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CheckIcon, SearchIcon } from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { useTRPC } from "@/trpc/client";
import type { LessonDetail } from "@/lib/queries/lesson";
import { LessonNotesPanel } from "./lesson-notes-panel";

type Props = {
  lesson: LessonDetail;
};

export function ReadingView({ lesson }: Props) {
  const reading = lesson.reading;
  const router = useRouter();
  const trpc = useTRPC();
  const markComplete = useMutation(
    trpc.markReadingComplete.mutationOptions({
      onSuccess: () => router.refresh(),
    }),
  );

  if (!reading) {
    return <p className="text-sm text-muted-foreground">No reading content available.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {reading.overview ? (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-5">
          <h2 className="font-heading text-lg font-semibold">Overview</h2>
          <div className="prose-sm whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {reading.overview}
          </div>
        </section>
      ) : null}

      <article className="prose prose-neutral dark:prose-invert max-w-none whitespace-pre-wrap text-base leading-relaxed">
        {reading.content}
      </article>

      {reading.recommendedResources.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold">Further reading</h2>
          <ul className="flex flex-col gap-2">
            {reading.recommendedResources.map((resource) => (
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
                  href={`https://www.google.com/search?q=${encodeURIComponent(resource.searchQuery)}`}
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
          variant={reading.isCompleted ? "outline" : "default"}
          className="cursor-pointer"
          disabled={markComplete.isPending}
          onClick={() =>
            markComplete.mutate({
              readingId: reading.id,
              isCompleted: !reading.isCompleted,
            })
          }
        >
          <CheckIcon className="size-4" />
          {reading.isCompleted ? "Marked as read" : "Mark as read"}
        </Button>
      </div>

      <LessonNotesPanel
        lessonId={lesson.id}
        curriculumId={lesson.module.curriculum.id}
      />
    </div>
  );
}
