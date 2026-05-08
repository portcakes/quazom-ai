"use client";

import { Progress } from "@quazom-ai/ui/components/ui/progress";
import { Skeleton } from "@quazom-ai/ui/components/ui/skeleton";
import type { AlphaUsageSnapshot } from "@/lib/alpha-limits";

type Props = {
  usage: AlphaUsageSnapshot | undefined;
  isLoading: boolean;
};

type Row = {
  label: string;
  description: string;
  used: number;
  limit: number;
};

export function UsageMeter({ usage, isLoading }: Props) {
  if (isLoading || !usage) {
    return (
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!usage.isAlpha) {
    return (
      <p className="text-sm text-muted-foreground">
        Generation caps don&apos;t apply to your account.
      </p>
    );
  }

  const rows: Row[] = [
    {
      label: "Curricula",
      description: "Total curricula across your account.",
      used: usage.curricula.used,
      limit: usage.curricula.limit,
    },
    {
      label: "Lesson generations this month",
      description: "Counts every lesson, including retries.",
      used: usage.lessonsThisMonth.used,
      limit: usage.lessonsThisMonth.limit,
    },
    {
      label: "Discussion lessons this month",
      description: "A subset of the lesson cap above.",
      used: usage.discussionsThisMonth.used,
      limit: usage.discussionsThisMonth.limit,
    },
  ];

  return (
    <ul className="flex flex-col gap-5">
      {rows.map((row) => {
        const pct = row.limit === 0 ? 0 : Math.min(100, (row.used / row.limit) * 100);
        const atLimit = row.used >= row.limit;
        return (
          <li key={row.label} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">{row.label}</span>
              <span
                className={
                  atLimit
                    ? "text-sm font-semibold text-destructive"
                    : "text-sm text-muted-foreground"
                }
              >
                {row.used} / {row.limit}
              </span>
            </div>
            <Progress value={pct} />
            <span className="text-xs text-muted-foreground">{row.description}</span>
          </li>
        );
      })}
    </ul>
  );
}
