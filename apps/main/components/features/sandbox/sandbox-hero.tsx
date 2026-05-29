"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import {
  FilesIcon,
  FlaskConicalIcon,
  GraduationCapIcon,
  MessagesSquareIcon,
} from "lucide-react";
import { cn } from "@quazom-ai/ui/lib/utils";

type Props = {
  title: string;
  description: string;
  thesis: string | null;
  sourceCount: number;
  researchSessionCount: number;
  materialCount: number;
};

// Trigger collapse once the hero's bottom passes the sticky chrome height
// reserved on portrait mobile (mobile navbar h-12 + compact header h-12).
// Mirrors CurriculumHero so the sandbox + curriculum pages collapse
// identically.
const COLLAPSE_TRIGGER_PX = 96;

export function SandboxHero({
  title,
  description,
  thesis,
  sourceCount,
  researchSessionCount,
  materialCount,
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
      },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* h-0 sticky wrapper keeps the compact bar out of normal flow so it
          never adds vertical space at the top of the page. The `top` offset
          adds the audio player bar's height (published as
          `--audio-bar-offset` while it's visible) so the compact bar slots
          in below the audio bar — and crucially fills the band above the
          sticky tabs so page content never shows through. */}
      <div className="sticky top-[calc(3rem_+_var(--audio-bar-offset,0px))] z-20 h-0 md:top-[var(--audio-bar-offset,0px)]">
        <div
          aria-hidden={!collapsed}
          className={cn(
            "absolute inset-x-0 top-0 flex h-12 items-center border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
            "transition-opacity duration-150",
            collapsed ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <div className="mx-auto flex w-full max-w-4xl items-center gap-2 px-6">
            <FlaskConicalIcon className="size-4 shrink-0 text-orange-600" />
            <h2 className="truncate font-heading text-base font-semibold tracking-tight">
              {title}
            </h2>
          </div>
        </div>
      </div>

      <section
        ref={heroRef}
        className="border-b border-border bg-gradient-to-b from-orange-500/5 via-muted/30 to-background"
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-8 md:py-12">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="gap-1 border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300"
            >
              <FlaskConicalIcon className="size-3" />
              Knowledge Sandbox
            </Badge>
            <Badge variant="outline" className="gap-1">
              <FilesIcon className="size-3" />
              {sourceCount} source{sourceCount === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <MessagesSquareIcon className="size-3" />
              {researchSessionCount} research session
              {researchSessionCount === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <GraduationCapIcon className="size-3" />
              {materialCount} material{materialCount === 1 ? "" : "s"}
            </Badge>
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
          {thesis ? (
            <div className="max-w-2xl rounded-lg border border-border bg-card/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Working thesis
              </p>
              <p className="mt-1 text-sm leading-relaxed text-foreground">
                {thesis}
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
