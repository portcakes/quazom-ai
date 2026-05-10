import type { LucideIcon } from "lucide-react";
import { cn } from "@quazom-ai/ui/lib/utils";

type Props = {
  label: string;
  value: string | number;
  /** Optional subtitle line shown below the value (e.g. "of 234 all-time"). */
  hint?: string;
  /** Optional icon rendered top-right inside the primary tint badge. */
  icon?: LucideIcon;
  /** Stretches the card across both columns on mobile / two on desktop. */
  span?: "default" | "wide";
  /** Compact = 1-line layout, used inside dense tables. */
  density?: "comfortable" | "compact";
};

/**
 * Branded number card used across the admin dashboard. Sticks to the
 * Quazom palette (`primary` / `card` / `muted-foreground`) and the serif
 * Libre Baskerville for the value so it reads like a typeset figure rather
 * than a generic data-vis numeric.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  span = "default",
  density = "comfortable",
}: Props) {
  return (
    <div
      className={cn(
        "group flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md",
        span === "wide" && "sm:col-span-2",
        density === "compact" && "p-4 gap-2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        {Icon ? (
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-heading text-3xl font-bold tracking-tight text-foreground">
          {typeof value === "number" ? formatNumber(value) : value}
        </span>
      </div>
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}
