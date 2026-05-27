"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  LayersIcon,
  LinkIcon,
  FileTextIcon,
  TagIcon,
  BookOpenIcon,
} from "lucide-react";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { Progress } from "@quazom-ai/ui/components/ui/progress";
import { cn } from "@quazom-ai/ui/lib/utils";
import type {
  CurriculumProgress,
  CurriculumSourceSummary,
} from "@/lib/queries/curriculum";
import { SpeakTextButton } from "@/components/shared/speak-text-button";

type Props = {
  curriculumId: string;
  title: string;
  overview: string;
  estimatedDuration: string;
  progress: CurriculumProgress;
  // SINGLE | CONTINUITY. Optional so legacy callers don't break — defaults
  // to SINGLE which renders without the continuity badge / sources strip.
  kind?: "SINGLE" | "CONTINUITY";
  sources?: CurriculumSourceSummary[];
  thesis?: string | null;
};

// Trigger collapse once the hero's bottom passes the sticky chrome height
// reserved on portrait mobile (mobile navbar h-12 + compact header h-12).
// On larger viewports the chrome is shorter, which means the compact bar
// fades in slightly earlier than strictly needed — that's fine and avoids
// a visible "empty band" between the hero and the sticky tabs.
const COLLAPSE_TRIGGER_PX = 96;

export function CurriculumHero({
  curriculumId,
  title,
  overview,
  estimatedDuration,
  progress,
  kind = "SINGLE",
  sources = [],
  thesis = null,
}: Props) {
  const heroRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);

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
      }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* h-0 sticky wrapper keeps the compact bar out of normal flow, so it
          never adds vertical space at the top of the page. Because this is
          `sticky` (not `fixed`) it stays inside the parent's content box,
          which means it correctly respects the inline desktop sidebar
          bounds instead of overlapping it. The `top` offset adds the
          audio player bar's height (published as the
          `--audio-bar-offset` CSS variable while it's visible) so the
          compact bar slots in below the audio bar. */}
      <div
        className="sticky top-[calc(3rem_+_var(--audio-bar-offset,0px))] z-20 h-0 md:top-[var(--audio-bar-offset,0px)]"
      >
        <div
          aria-hidden={!collapsed}
          className={cn(
            "absolute inset-x-0 top-0 flex h-12 items-center border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
            "transition-opacity duration-150",
            collapsed ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <div className="mx-auto flex w-full max-w-4xl items-center px-6">
            <h2 className="truncate font-heading text-base font-semibold tracking-tight">
              {title}
            </h2>
          </div>
        </div>
      </div>

      <section
        ref={heroRef}
        className="border-b border-border bg-gradient-to-b from-muted/40 to-background bg-background"
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-6 py-6 md:gap-4 md:py-12">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {progress.currentTopLevel}
            </Badge>
            <Badge variant="outline">{estimatedDuration}</Badge>
            {kind === "CONTINUITY" ? (
              <Badge
                variant="outline"
                className="border-yellow-500/40 bg-yellow-500/10 text-yellow-900 dark:text-yellow-300"
                title="Generated from multiple sources"
              >
                <LayersIcon className="mr-1 size-3" />
                Continuity
              </Badge>
            ) : null}
            {progress.totalLessonCount > 0 && progress.percent >= 100 ? (
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              >
                <CheckCircle2Icon className="mr-1 size-3" />
                Complete
              </Badge>
            ) : null}
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {title}
          </h1>
          {thesis ? (
            <blockquote className="max-w-3xl border-l-2 border-indigo-500/40 bg-indigo-500/5 px-4 py-2 text-sm italic text-muted-foreground">
              {thesis}
            </blockquote>
          ) : null}
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {overview}
          </p>
          {sources.length > 0 ? (
            <SourceChips sources={sources} />
          ) : null}
          {overview ? (
            <SpeakTextButton
              text={overview}
              label="Speak overview"
              className="self-start"
              source={{
                kind: "curriculum-overview",
                curriculumId,
                curriculumTitle: title,
              }}
            />
          ) : null}
          {progress.totalLessonCount > 0 ? (
            <div className="flex max-w-3xl flex-col gap-1.5 pt-1">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {progress.completedLessonCount} of {progress.totalLessonCount}{" "}
                  lessons complete
                </span>
                <span className="font-mono tabular-nums text-foreground">
                  {progress.percent}%
                </span>
              </div>
              <Progress
                value={progress.percent}
                className={cn(
                  "h-2",
                  progress.percent >= 100
                    ? "[&>[data-slot=progress-indicator]]:bg-emerald-500"
                    : null,
                )}
              />
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

// Inline chip strip listing the sources used to generate this curriculum.
// Links open the resource in a new tab; topics and continuity-note
// references render as labelled badges without affordances.
function SourceChips({ sources }: { sources: CurriculumSourceSummary[] }) {
  return (
    <div className="flex max-w-3xl flex-wrap items-center gap-2 pt-1 text-xs">
      <span className="text-muted-foreground">
        Generated from {sources.length} source
        {sources.length === 1 ? "" : "s"}:
      </span>
      {sources.map((s) => {
        if (s.kind === "TOPIC") {
          return (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-foreground"
            >
              <TagIcon className="size-3 text-muted-foreground" />
              {s.topicText}
            </span>
          );
        }
        if (s.kind === "CONTINUITY_NOTE") {
          return (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-foreground"
              title="Continuity note"
            >
              <BookOpenIcon className="size-3 text-muted-foreground" />
              {s.continuityNoteTitle ?? "Untitled note"}
            </span>
          );
        }
        const label = s.resourceTitle ?? s.resourceDomain ?? "Source";
        const icon =
          s.kind === "LINK_RESOURCE" ? (
            <LinkIcon className="size-3 text-muted-foreground" />
          ) : (
            <FileTextIcon className="size-3 text-muted-foreground" />
          );
        if (s.kind === "LINK_RESOURCE" && s.resourceUrl) {
          return (
            <a
              key={s.id}
              href={s.resourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-foreground hover:bg-accent"
              title={s.resourceUrl}
            >
              {icon}
              <span className="truncate max-w-[200px]">{label}</span>
            </a>
          );
        }
        return (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-foreground"
          >
            {icon}
            <span className="truncate max-w-[200px]">{label}</span>
          </span>
        );
      })}
    </div>
  );
}
