import Link from "next/link";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { Progress } from "@quazom-ai/ui/components/ui/progress";
import {
  CheckCircle2Icon,
  FilesIcon,
  FlaskConicalIcon,
  MessagesSquareIcon,
} from "lucide-react";
import { cn } from "@quazom-ai/ui/lib/utils";
import type { SandboxCardSummary } from "@/lib/queries/sandbox";

type Props = {
  sandbox: SandboxCardSummary;
};

export function SandboxCollectionCard({ sandbox }: Props) {
  const percent =
    sandbox.totalMaterialCount > 0
      ? Math.round(
          (sandbox.completedMaterialCount / sandbox.totalMaterialCount) * 100,
        )
      : 0;
  const complete = sandbox.totalMaterialCount > 0 && percent >= 100;

  return (
    <Link
      href={`/sandboxes/${sandbox.id}`}
      className={cn(
        "group flex h-full flex-col gap-4 rounded-xl border bg-card p-5 ring-1 ring-transparent transition-colors hover:border-foreground/20 hover:ring-foreground/10 focus-visible:outline-none focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring",
        complete ? "border-emerald-500/40 bg-emerald-500/5" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="gap-1 border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300"
        >
          <FlaskConicalIcon className="size-3" />
          Sandbox
        </Badge>
        <Badge variant="outline" className="gap-1">
          <FilesIcon className="size-3" />
          {sandbox.sourceCount} source{sandbox.sourceCount === 1 ? "" : "s"}
        </Badge>
        <Badge variant="outline" className="gap-1">
          <MessagesSquareIcon className="size-3" />
          {sandbox.researchSessionCount} session
          {sandbox.researchSessionCount === 1 ? "" : "s"}
        </Badge>
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
      <h3 className="font-heading text-xl font-semibold leading-tight tracking-tight text-foreground">
        {sandbox.title}
      </h3>
      {sandbox.description ? (
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {sandbox.description}
        </p>
      ) : (
        <p className="text-sm italic leading-relaxed text-muted-foreground/70">
          A research workspace.
        </p>
      )}
      {sandbox.totalMaterialCount > 0 ? (
        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {sandbox.completedMaterialCount} / {sandbox.totalMaterialCount}{" "}
              materials
            </span>
            <span className="font-mono tabular-nums">{percent}%</span>
          </div>
          <Progress
            value={percent}
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
