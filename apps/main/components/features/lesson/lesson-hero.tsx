"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, LibraryIcon, PlusIcon } from "lucide-react";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { cn } from "@quazom-ai/ui/lib/utils";
import type { LessonDetail } from "@/lib/queries/lesson";
import { NoteBottomSheet } from "@/components/features/notes/note-bottom-sheet";
import { AddResourceDialog } from "@/components/features/resources/add-resource-dialog";

type Props = {
  lesson: Pick<
    LessonDetail,
    "id" | "title" | "summary" | "duration" | "activityType" | "module"
  >;
};

// Trigger collapse once the hero's bottom passes the sticky chrome height
// reserved on portrait mobile (mobile navbar h-12 + compact header h-12).
const COLLAPSE_TRIGGER_PX = 96;

export function LessonHero({ lesson }: Props) {
  const heroRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [resourceOpen, setResourceOpen] = useState(false);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setCollapsed(!entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: `-${COLLAPSE_TRIGGER_PX}px 0px 0px 0px`,
      },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Sticky compact header — appears on scroll, mirroring the curriculum
          page chrome. Holds the title plus a quick "Create Note" action.
          `top` adds the audio player bar's height (published as the
          `--audio-bar-offset` CSS variable when visible) so the compact
          bar slots in below the audio bar instead of being painted over. */}
      <div
        className="sticky top-[calc(3rem_+_var(--audio-bar-offset,0px))] z-20 h-0 md:top-[var(--audio-bar-offset,0px)]"
      >
        <div
          aria-hidden={!collapsed}
          className={cn(
            "absolute inset-x-0 top-0 flex h-12 items-center border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
            "transition-opacity duration-150",
            collapsed ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {/* Compact back-to-curriculum link so the user can bail out
                  without scrolling back to the hero on long lessons. */}
              <Link
                href={`/curricula/${lesson.module.curriculum.id}`}
                aria-label={`Back to ${lesson.module.curriculum.title}`}
                className="flex shrink-0 items-center gap-1 rounded-md px-1 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeftIcon className="size-3.5" />
                <span className="hidden max-w-[20ch] truncate sm:inline">
                  {lesson.module.curriculum.title}
                </span>
              </Link>
              <span className="hidden text-muted-foreground/60 sm:inline">/</span>
              <h2 className="min-w-0 truncate font-heading text-base font-semibold tracking-tight">
                {lesson.title}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                className="cursor-pointer"
                onClick={() => setNoteOpen(true)}
              >
                <PlusIcon className="size-4" />
                <span className="hidden sm:inline">Create note</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={() => setResourceOpen(true)}
              >
                <LibraryIcon className="size-4" />
                <span className="hidden sm:inline">Add resource</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <section
        ref={heroRef}
        className="border-b border-border bg-gradient-to-b from-muted/40 to-background"
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-6 py-6 md:gap-4 md:py-10">
          <div className="flex items-start justify-between gap-4">
            <Link
              href={`/curricula/${lesson.module.curriculum.id}`}
              className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftIcon className="size-3.5 shrink-0" />
              <span className="truncate">{lesson.module.curriculum.title}</span>
              <span className="text-muted-foreground/60">/</span>
              <span className="truncate">{lesson.module.title}</span>
            </Link>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={() => setNoteOpen(true)}
              >
                <PlusIcon className="size-4" />
                Create note
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={() => setResourceOpen(true)}
              >
                <LibraryIcon className="size-4" />
                Add resource
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {lesson.activityType.toLowerCase()}
            </Badge>
            {lesson.duration ? (
              <Badge variant="outline">{lesson.duration}</Badge>
            ) : null}
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {lesson.title}
          </h1>
          {lesson.summary ? (
            <p className="max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {lesson.summary}
            </p>
          ) : null}
        </div>
      </section>

      <NoteBottomSheet
        open={noteOpen}
        onOpenChange={setNoteOpen}
        lessonId={lesson.id}
        curriculumId={lesson.module.curriculum.id}
      />

      <AddResourceDialog
        open={resourceOpen}
        onOpenChange={setResourceOpen}
        scope={{
          lessonId: lesson.id,
          curriculumId: lesson.module.curriculum.id,
        }}
        scopeLabel={lesson.title}
      />
    </>
  );
}
