"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  Loader2Icon,
  LockIcon,
  SparklesIcon,
  TrophyIcon,
} from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { Progress } from "@quazom-ai/ui/components/ui/progress";
import { cn } from "@quazom-ai/ui/lib/utils";
import { useTRPC } from "@/trpc/client";
import type { CurriculumModuleWithLessons } from "@/lib/queries/lesson";
import type { CurriculumProgress } from "@/lib/queries/curriculum";
import { ModuleCard } from "./module-card";

type Props = {
  curriculumId: string;
  modules: CurriculumModuleWithLessons[];
  progress: CurriculumProgress;
};

export function ModulesTab({ curriculumId, modules, progress }: Props) {
  if (modules.length === 0) {
    return <ModulesEmptyState curriculumId={curriculumId} />;
  }

  // Group modules by level for the rendered layout. The map keys preserve
  // insertion order so beginner → intermediate → advanced is naturally the
  // order they appear in.
  const grouped = new Map<string, CurriculumModuleWithLessons[]>();
  for (const m of modules) {
    const key = m.level.toLowerCase();
    const arr = grouped.get(key) ?? [];
    arr.push(m);
    grouped.set(key, arr);
  }

  return (
    <div className="flex flex-col gap-6">
      <CurriculumProgressBlock progress={progress} />

      {Array.from(grouped.entries()).map(([level, list]) => (
        <div key={level} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {level}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {list.filter((m) => m.isCompleted).length}/{list.length} modules
              complete
            </span>
          </div>
          <ul className="flex flex-col gap-3">
            {list.map((module) => (
              <li key={module.id} className="min-w-0">
                <ModuleCard
                  module={module}
                  index={modules.findIndex((m) => m.id === module.id)}
                />
              </li>
            ))}
          </ul>
          {/* The CTA only ever attaches to the *current top* level so the
              learner can't accidentally extend twice from the same view. */}
          {level === progress.currentTopLevel ? (
            <LevelProgressionCta
              curriculumId={curriculumId}
              progress={progress}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

// Header block that renders above the module grouping. Displays the overall
// curriculum progress (across every level) so the learner sees their growth
// at a glance.
function CurriculumProgressBlock({ progress }: { progress: CurriculumProgress }) {
  const complete = progress.totalLessonCount > 0 && progress.percent >= 100;
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-5",
        complete ? "border-emerald-500/40 bg-emerald-500/5" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {complete ? (
            <CheckCircle2Icon className="size-5 text-emerald-500" />
          ) : null}
          <h3 className="font-heading text-lg font-semibold">
            Curriculum progress
          </h3>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {progress.completedLessonCount} / {progress.totalLessonCount} lessons
          </span>
          <span className="font-mono tabular-nums text-foreground">
            {progress.percent}%
          </span>
        </div>
      </div>
      <Progress
        value={progress.percent}
        className={cn(
          "h-2",
          complete ? "[&>[data-slot=progress-indicator]]:bg-emerald-500" : null,
        )}
      />
    </section>
  );
}

// CTA that unlocks once the current top-level batch is fully complete.
// Advanced curricula see a "you're at the top" state instead — there's
// nothing left to generate.
function LevelProgressionCta({
  curriculumId,
  progress,
}: {
  curriculumId: string;
  progress: CurriculumProgress;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const [waiting, setWaiting] = useState(false);

  const extend = useMutation(
    trpc.extendCurriculumLevel.mutationOptions({
      onSuccess: () => {
        setWaiting(true);
        toast.success("Generating next-level modules…");
      },
      onError: (err) => {
        setWaiting(false);
        toast.error(err.message ?? "Failed to extend curriculum");
      },
    }),
  );

  if (progress.nextLevel === null) {
    // Already at advanced. Surface a celebratory state instead of a CTA.
    if (progress.topLevelComplete) {
      return (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5 text-center">
          <TrophyIcon className="size-6 text-emerald-500" />
          <p className="font-heading text-base font-semibold">
            You&apos;ve completed the advanced tier
          </p>
          <p className="text-sm text-muted-foreground">
            This curriculum is at the highest level we generate — review what
            you&apos;ve covered, or spin up a fresh curriculum to keep going.
          </p>
        </div>
      );
    }
    return null;
  }

  if (!progress.topLevelComplete) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 p-5 text-center">
        <LockIcon className="size-5 text-muted-foreground" />
        <p className="font-heading text-sm font-medium">
          Unlock {progress.nextLevel} modules
        </p>
        <p className="text-xs text-muted-foreground">
          Complete every lesson at the current {progress.currentTopLevel} level
          to generate harder material.
        </p>
      </div>
    );
  }

  const isPending = extend.isPending || waiting;
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center">
      <div className="flex flex-col gap-1">
        <p className="font-heading text-base font-semibold">
          Ready for {progress.nextLevel} material?
        </p>
        <p className="text-sm text-muted-foreground">
          You&apos;ve cleared every {progress.currentTopLevel} lesson. Generate
          a fresh batch of {progress.nextLevel} modules that build on what
          you&apos;ve already covered.
        </p>
      </div>
      <Button
        type="button"
        className="cursor-pointer"
        disabled={isPending}
        onClick={() => {
          // Guarded by the parent's `nextLevel === null` early return, so
          // the bang here is safe — narrow it for the mutation's input.
          const target = progress.nextLevel;
          if (target === null || target === "beginner") return;
          extend.mutate({ curriculumId, targetLevel: target });
        }}
      >
        {isPending ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <SparklesIcon className="size-4" />
            Generate {progress.nextLevel} modules
          </>
        )}
      </Button>
      {waiting ? (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline cursor-pointer"
        >
          Done? Refresh now
        </button>
      ) : null}
    </div>
  );
}

function ModulesEmptyState({ curriculumId }: { curriculumId: string }) {
  const router = useRouter();
  const trpc = useTRPC();
  // The realtime curriculumReady listener at the layout level fires
  // router.refresh() once the backfill finishes, so we only need to track
  // pending state until then.
  const [waiting, setWaiting] = useState(false);

  const backfill = useMutation(
    trpc.backfillCurriculumModules.mutationOptions({
      onSuccess: () => {
        setWaiting(true);
        toast.success("Generating modules…");
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to start backfill");
        setWaiting(false);
      },
    }),
  );

  const isPending = backfill.isPending || waiting;

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
      <div className="flex flex-col gap-1">
        <p className="font-heading text-base font-medium">No modules yet</p>
        <p className="text-sm text-muted-foreground">
          This curriculum doesn&apos;t have any modules. Generate a fresh
          structure of 4–5 modules with 5–8 lessons each.
        </p>
        <p className="text-xs text-muted-foreground/80">
          Dev tool: lets you recover curricula created before per-lesson stubs
          were added.
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        className="cursor-pointer"
        disabled={isPending}
        onClick={() => backfill.mutate({ curriculumId })}
      >
        {isPending ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <SparklesIcon className="size-4" />
            Generate modules
          </>
        )}
      </Button>
      {waiting ? (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline cursor-pointer"
        >
          Done? Refresh now
        </button>
      ) : null}
    </div>
  );
}
