"use client";

import { useEffect, useState } from "react";
import { cn } from "@quazom-ai/ui/lib/utils";

type CyclingTaglineProps = {
  taglines: readonly string[];
  /**
   * Index of the tagline that should be visible on first render. Pinning this
   * from the server avoids a hydration flash; the rest of the rotation is
   * shuffled on the client.
   */
  initialIndex?: number;
  /** Time the active tagline stays on screen before the next one swaps in. */
  intervalMs?: number;
  className?: string;
};

function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function CyclingTagline({
  taglines,
  initialIndex = 0,
  intervalMs = 3000,
  className,
}: CyclingTaglineProps) {
  const safeInitial =
    taglines.length > 0
      ? ((initialIndex % taglines.length) + taglines.length) % taglines.length
      : 0;

  // Keep the SSR-rendered tagline at order[0] so the first client render
  // matches the server output (no hydration flash).
  const [order, setOrder] = useState<readonly string[]>(() => {
    if (taglines.length === 0) return taglines;
    const head = taglines[safeInitial]!;
    const rest = taglines.filter((_, i) => i !== safeInitial);
    return [head, ...rest];
  });

  const [state, setState] = useState<{
    current: number;
    previous: number | null;
    tick: number;
  }>({ current: 0, previous: null, tick: 0 });

  // Reshuffle the rotation once we're on the client so each visit feels fresh,
  // while keeping the currently-visible tagline pinned at index 0.
  useEffect(() => {
    if (taglines.length <= 2) return;
    setOrder((prev) => {
      const head = prev[0]!;
      const rest = shuffle(prev.slice(1));
      return [head, ...rest];
    });
  }, [taglines]);

  useEffect(() => {
    if (order.length <= 1) return;
    const id = window.setInterval(() => {
      setState((s) => ({
        current: (s.current + 1) % order.length,
        previous: s.current,
        tick: s.tick + 1,
      }));
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [order.length, intervalMs]);

  if (order.length === 0) return null;

  return (
    <span
      className={cn("relative inline-grid align-baseline", className)}
      aria-live="polite"
      aria-atomic="true"
    >
      {state.previous !== null ? (
        <span
          aria-hidden
          key={`out-${state.tick}`}
          className="col-start-1 row-start-1 motion-reduce:hidden motion-safe:animate-out motion-safe:fade-out motion-safe:slide-out-to-bottom-2 motion-safe:fill-mode-forwards motion-safe:duration-500"
        >
          {order[state.previous]}
        </span>
      ) : null}
      <span
        key={`in-${state.tick}`}
        className="col-start-1 row-start-1 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-500"
      >
        {order[state.current]}
      </span>
    </span>
  );
}
