"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { useTRPC } from "@/trpc/client";
import type { CurriculumModuleWithLessons } from "@/lib/queries/lesson";
import { ModuleCard } from "./module-card";

type Props = {
  curriculumId: string;
  modules: CurriculumModuleWithLessons[];
};

export function ModulesTab({ curriculumId, modules }: Props) {
  if (modules.length === 0) {
    return <ModulesEmptyState curriculumId={curriculumId} />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {modules.map((module, index) => (
        <li key={module.id} className="min-w-0">
          <ModuleCard module={module} index={index} />
        </li>
      ))}
    </ul>
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
