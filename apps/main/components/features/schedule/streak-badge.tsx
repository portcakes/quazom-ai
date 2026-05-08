"use client";

import { FlameIcon } from "lucide-react";
import { cn } from "@quazom-ai/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

type Props = {
  className?: string;
  /** When true, render only the number + flame, no "day streak" text. */
  compact?: boolean;
};

/**
 * Tiny chip that surfaces the user's current daily check-in streak. Used on
 * widgets, the curriculum tab, and the dedicated /schedule page so the number
 * is always visible.
 */
export function StreakBadge({ className, compact }: Props) {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.getStreak.queryOptions());

  const streak = data?.streak ?? 0;
  const checkedInToday = data?.checkedInToday ?? false;

  // Once the streak hits 1 we treat it as "lit"; before that, the icon is
  // muted to encourage the user to check in for the first time.
  const lit = streak > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums",
        lit
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-border bg-muted/40 text-muted-foreground",
        className,
      )}
      title={
        lit
          ? checkedInToday
            ? `${streak}-day streak — checked in today`
            : `${streak}-day streak — check in today to keep it`
          : "Check in today to start your streak"
      }
    >
      <FlameIcon className={cn("size-3.5", lit ? "fill-current" : "")} />
      {compact ? streak : `${streak} day${streak === 1 ? "" : "s"}`}
    </span>
  );
}
