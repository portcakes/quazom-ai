"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2Icon } from "lucide-react";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { Progress } from "@quazom-ai/ui/components/ui/progress";
import { cn } from "@quazom-ai/ui/lib/utils";
import type { CurriculumProgress } from "@/lib/queries/curriculum";

type Props = {
  title: string;
  overview: string;
  estimatedDuration: string;
  progress: CurriculumProgress;
};

// Trigger collapse once the hero's bottom passes the sticky chrome height
// reserved on portrait mobile (mobile navbar h-12 + compact header h-12).
// On larger viewports the chrome is shorter, which means the compact bar
// fades in slightly earlier than strictly needed — that's fine and avoids
// a visible "empty band" between the hero and the sticky tabs.
const COLLAPSE_TRIGGER_PX = 96;

export function CurriculumHero({
  title,
  overview,
  estimatedDuration,
  progress,
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
          bounds instead of overlapping it. */}
      <div className="sticky top-12 z-20 h-0 md:top-0">
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
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {overview}
          </p>
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
