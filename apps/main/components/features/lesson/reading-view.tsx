"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CheckIcon, SearchIcon } from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { useTRPC } from "@/trpc/client";
import type { LessonDetail } from "@/lib/queries/lesson";
import { AnnotatedMarkdown } from "@/components/features/notes/annotated-markdown";
import { SpeakTextButton } from "@/components/shared/speak-text-button";
import { Highlightable } from "./highlightable";
import { LessonNotesPanel } from "./lesson-notes-panel";
import { useSyncScheduleProgress } from "./use-sync-schedule-progress";

type Props = {
  lesson: LessonDetail;
};

export function ReadingView({ lesson }: Props) {
  const reading = lesson.reading;
  const router = useRouter();
  const trpc = useTRPC();
  const syncScheduleProgress = useSyncScheduleProgress();
  const markComplete = useMutation(
    trpc.markReadingComplete.mutationOptions({
      onSuccess: () => {
        syncScheduleProgress();
        router.refresh();
      },
    }),
  );
  const annotationsQuery = useQuery(
    trpc.listAnnotations.queryOptions({ lessonId: lesson.id }),
  );
  const annotations = annotationsQuery.data ?? [];

  if (!reading) {
    return <p className="text-sm text-muted-foreground">No reading content available.</p>;
  }

  return (
    <Highlightable
      lessonId={lesson.id}
      curriculumId={lesson.module.curriculum.id}
    >
      <div className="flex flex-col gap-8">
        {reading.overview ? (
          <section className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-heading text-lg font-semibold">Overview</h2>
              <SpeakTextButton
                text={reading.overview}
                source={{
                  kind: "lesson-overview",
                  lessonId: lesson.id,
                  lessonTitle: lesson.title,
                  curriculumId: lesson.module.curriculum.id,
                }}
              />
            </div>
            <AnnotatedMarkdown
              compact
              className="text-muted-foreground"
              annotations={annotations}
            >
              {reading.overview}
            </AnnotatedMarkdown>
          </section>
        ) : null}

        <article className="flex max-w-none flex-col gap-3">
          <SpeakTextButton
            text={reading.content}
            label="Speak reading"
            className="self-start"
            source={{
              kind: "lesson-reading",
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              curriculumId: lesson.module.curriculum.id,
            }}
          />
          <AnnotatedMarkdown annotations={annotations}>
            {reading.content}
          </AnnotatedMarkdown>
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
    </Highlightable>
  );
}

// Video resources go to YouTube, everything else to Google. Keeps the link
// targeting consistent with how the AI is asked to seed `searchQuery`.
function resourceSearchUrl(type: string, query: string): string {
  const q = encodeURIComponent(query);
  if (type === "video") {
    return `https://www.youtube.com/results?search_query=${q}`;
  }
  return `https://www.google.com/search?q=${q}`;
}
