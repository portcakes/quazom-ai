"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@quazom-ai/ui/lib/utils";
import {
  WAITLIST_FILTER_OPTIONS,
  waitlistFilterLabel,
  type WaitlistFilter,
} from "@/lib/waitlist-filter";

type Props = {
  active: WaitlistFilter;
};

/**
 * Pill-style waitlist filter rendered above the waitlist table. Mirrors
 * the existing {@link RangeSelector} pattern so the two filter UIs feel
 * the same. State lives in `?filter=` so links / refreshes stay
 * shareable.
 */
export function WaitlistFilterSelector({ active }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setFilter = (next: WaitlistFilter) => {
    if (next === active) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") {
      params.delete("filter");
    } else {
      params.set("filter", next);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  };

  return (
    <div
      role="tablist"
      aria-label="Waitlist filter"
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-card p-1 shadow-xs",
        isPending && "opacity-70",
      )}
    >
      {WAITLIST_FILTER_OPTIONS.map((id) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
              isActive
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {waitlistFilterLabel(id)}
          </button>
        );
      })}
    </div>
  );
}
