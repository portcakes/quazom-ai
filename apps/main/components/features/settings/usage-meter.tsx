"use client";

import { Progress } from "@quazom-ai/ui/components/ui/progress";
import { Skeleton } from "@quazom-ai/ui/components/ui/skeleton";
import type {
  PlanUsageSnapshot,
  UsageRow,
} from "@/lib/subscription/plan-limits";

type Props = {
  usage: PlanUsageSnapshot | undefined;
  isLoading: boolean;
};

type Row = {
  label: string;
  description: string;
  data: UsageRow;
};

const PLAN_LABELS: Record<PlanUsageSnapshot["plan"], string> = {
  ALPHA: "Open Alpha",
  FREE: "Free",
  EXPLORER: "Explorer",
  SCHOLAR: "Scholar",
};

function periodLabel(period: UsageRow["period"]): string {
  return period === "lifetime" ? "lifetime" : "this month";
}

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

  // Scholar (and anything else with every meter unlimited) gets a friendly
  // "no caps apply" line. Continuity curricula always carry a cap, so we
  // never hit this branch with a real Scholar account today — but treat
  // the row as a non-blocker for the simplified message.
  if (
    usage.curricula.limit === null &&
    usage.continuityCurricula.limit === null &&
    usage.lessonsThisMonth.limit === null &&
    usage.discussionsThisMonth.limit === null &&
    usage.ttsThisMonth.limit === null
  ) {
    return (
      <p className="text-sm text-muted-foreground">
        Generation caps don&apos;t apply to your {PLAN_LABELS[usage.plan]} plan
        — generate freely.
      </p>
    );
  }

  const rows: Row[] = [
    {
      label: "Curricula (single source)",
      description: `${PLAN_LABELS[usage.plan]} plan · ${periodLabel(usage.curricula.period)}.`,
      data: usage.curricula,
    },
    {
      label: "Continuity Curricula (multi-source)",
      description: `Counts curricula generated from 2+ sources · ${periodLabel(usage.continuityCurricula.period)}.`,
      data: usage.continuityCurricula,
    },
    {
      label: "Lesson generations this month",
      description: "Counts every lesson, including retries.",
      data: usage.lessonsThisMonth,
    },
    {
      label: "Discussion lessons this month",
      description: "A subset of the lesson cap above.",
      data: usage.discussionsThisMonth,
    },
    {
      label: "TTS generations this month",
      description: "Each unique note or passage you speak counts once.",
      data: usage.ttsThisMonth,
    },
  ];

  return (
    <ul className="flex flex-col gap-5">
      {rows.map((row) => {
        const limit = row.data.limit;
        const used = row.data.used;
        // Render a "Unlimited" pill when the cap is null (Scholar tier);
        // otherwise show the usual `used / limit` and progress bar.
        if (limit === null) {
          return (
            <li key={row.label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{row.label}</span>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  Unlimited
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {row.description}
              </span>
            </li>
          );
        }
        const pct = limit === 0 ? 0 : Math.min(100, (used / limit) * 100);
        const atLimit = used >= limit;
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
                {used} / {limit}
              </span>
            </div>
            <Progress value={pct} />
            <span className="text-xs text-muted-foreground">
              {row.description}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
