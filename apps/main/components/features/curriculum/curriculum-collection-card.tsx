import Link from "next/link";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { Progress } from "@quazom-ai/ui/components/ui/progress";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  LayersIcon,
  Loader2Icon,
} from "lucide-react";
import { cn } from "@quazom-ai/ui/lib/utils";
import type { CurriculumCardSummary } from "@/lib/queries/courses";

type Props = {
  curriculum: CurriculumCardSummary;
};

export function CurriculumCollectionCard({ curriculum }: Props) {
  const complete =
    curriculum.totalLessonCount > 0 &&
    curriculum.progressPercent >= 100;
  return (
    <Link
      href={`/curricula/${curriculum.id}`}
      className={cn(
        "group flex h-full flex-col gap-4 rounded-xl border bg-card p-5 ring-1 ring-transparent transition-colors hover:border-foreground/20 hover:ring-foreground/10 focus-visible:outline-none focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring",
        complete
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="capitalize">
          {curriculum.level}
        </Badge>
        <Badge variant="outline" className="gap-1">
          <ClockIcon className="size-3" />
          {curriculum.estimatedDuration}
        </Badge>
        {curriculum.kind === "CONTINUITY" ? (
          <Badge
            variant="outline"
            className="gap-1 border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
          >
            <LayersIcon className="size-3" />
            Continuity
          </Badge>
        ) : null}
        {curriculum.status === "PENDING" ? (
          <Badge
            variant="outline"
            className="gap-1 border-muted bg-muted/40 text-muted-foreground"
          >
            <Loader2Icon className="size-3 animate-spin" />
            Generating
          </Badge>
        ) : null}
        {curriculum.status === "FAILED" ? (
          <Badge
            variant="outline"
            className="gap-1 border-destructive/40 bg-destructive/10 text-destructive"
          >
            <AlertTriangleIcon className="size-3" />
            Failed
          </Badge>
        ) : null}
        {complete ? (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          >
            <CheckCircle2Icon className="size-3" />
            Complete
          </Badge>
        ) : null}
      </div>
      <h3 className="font-heading text-xl font-semibold leading-tight tracking-tight text-foreground group-hover:text-foreground">
        {curriculum.title}
      </h3>
      <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {curriculum.overview}
      </p>
      {curriculum.totalLessonCount > 0 ? (
        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {curriculum.completedLessonCount} / {curriculum.totalLessonCount}{" "}
              lessons
            </span>
            <span className="font-mono tabular-nums">
              {curriculum.progressPercent}%
            </span>
          </div>
          <Progress
            value={curriculum.progressPercent}
            className={cn(
              "h-1.5",
              complete
                ? "[&>[data-slot=progress-indicator]]:bg-emerald-500"
                : null,
            )}
          />
        </div>
      ) : null}
    </Link>
  );
}
