"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { cn } from "@quazom-ai/ui/lib/utils";

type Props = {
  title: string;
  overview: string;
  level: string;
  estimatedDuration: string;
};

// Heights (in tailwind spacing units / px) coordinated with mobile navbar
// and CurriculumTabs sticky offset:
//   - Portrait mobile (<md): navbar h-12 + compact header h-12 = 96px
//   - Landscape mobile (md..<lg): no navbar, just compact header h-12 = 48px
const COLLAPSE_TRIGGER_PX = 96;

export function CurriculumHero({
  title,
  overview,
  level,
  estimatedDuration,
}: Props) {
  const heroRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;

    // Observe regardless of viewport — the compact header hides itself on
    // lg+ via Tailwind classes. This keeps things consistent across
    // resizes without needing an extra resize listener.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setCollapsed(!entry.isIntersecting);
      },
      {
        threshold: 0,
        // Trigger collapse once the hero's bottom passes the area reserved
        // for the sticky chrome (navbar + compact header).
        rootMargin: `-${COLLAPSE_TRIGGER_PX}px 0px 0px 0px`,
      }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        aria-hidden={!collapsed}
        className={cn(
          "fixed inset-x-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden",
          // Sit below the mobile navbar on portrait (h-12), at the top on landscape mobile.
          "top-12 md:top-0",
          "transition-opacity duration-150",
          collapsed
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        <div className="mx-auto flex h-12 max-w-4xl items-center px-6">
          <h2 className="truncate font-heading text-base font-semibold tracking-tight">
            {title}
          </h2>
        </div>
      </div>

      <section
        ref={heroRef}
        className="border-b border-border bg-gradient-to-b from-muted/40 to-background bg-background lg:sticky lg:top-0 lg:z-10"
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-6 py-6 md:gap-4 md:py-12">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {level}
            </Badge>
            <Badge variant="outline">{estimatedDuration}</Badge>
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {title}
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {overview}
          </p>
        </div>
      </section>
    </>
  );
}
