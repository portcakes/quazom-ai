"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@quazom-ai/ui/lib/utils";
import { RANGE_IDS, rangeShortLabel, type RangeId } from "@/lib/range";

type Props = {
  active: RangeId;
};

/**
 * Pill-style time-range filter rendered above the dashboard KPIs and the
 * users table. Updating the range pushes the choice into a `?range=` query
 * param so every link / refresh remains shareable; the receiving server
 * component reads the param via {@link parseRangeId}.
 */
export function RangeSelector({ active }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setRange = (next: RangeId) => {
    if (next === active) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", next);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div
      role="tablist"
      aria-label="Time range"
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-card p-1 shadow-xs",
        isPending && "opacity-70",
      )}
    >
      {RANGE_IDS.map((id) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setRange(id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
              isActive
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {rangeShortLabel(id)}
          </button>
        );
      })}
    </div>
  );
}
