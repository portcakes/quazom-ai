"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2Icon, SparklesIcon, ArrowRightIcon, RefreshCwIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@quazom-ai/ui/components/ui/dialog";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { ScrollArea } from "@quazom-ai/ui/components/ui/scroll-area";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { useTRPC } from "@/trpc/client";
import type { CurriculumModuleWithLessons } from "@/lib/queries/lesson";

type Props = {
  module: CurriculumModuleWithLessons;
  index: number;
};

export function ModuleCard({ module, index }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group flex w-full min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:bg-sidebar-accent/40 hover:ring-1 hover:ring-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <div className="flex w-full items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-sm font-medium text-muted-foreground">
                {index + 1}
              </span>
              {/* break-words instead of truncate so long titles wrap on
                  narrow viewports rather than getting clipped past the
                  card edge. */}
              <h3 className="min-w-0 break-words font-heading text-lg font-semibold">
                {module.title}
              </h3>
            </div>
            <Badge variant="outline" className="shrink-0">
              {module.lessons.length}{" "}
              {module.lessons.length === 1 ? "lesson" : "lessons"}
            </Badge>
          </div>
          <p className="break-words text-sm leading-relaxed text-muted-foreground">
            {module.summary}
          </p>
          {module.objectives.length > 0 ? (
            <div className="flex w-full flex-wrap gap-2 pt-1">
              {module.objectives.map((objective) => (
                <Badge
                  key={objective}
                  variant="secondary"
                  className="h-auto max-w-full whitespace-normal py-1 text-left font-normal"
                >
                  {objective}
                </Badge>
              ))}
            </div>
          ) : null}
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="break-words font-heading text-xl">
            {module.title}
          </DialogTitle>
          <DialogDescription className="break-words">
            {module.summary}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lessons
          </h4>
          {module.lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No lessons listed for this module.
            </p>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-3">
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {module.lessons.map((lesson, i) => (
                  <li key={lesson.id}>
                    <LessonRow lesson={lesson} index={i} onNavigate={() => setOpen(false)} />
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type LessonRowProps = {
  lesson: CurriculumModuleWithLessons["lessons"][number];
  index: number;
  onNavigate: () => void;
};

function LessonRow({ lesson, index, onNavigate }: LessonRowProps) {
  const router = useRouter();
  const trpc = useTRPC();

  const generate = useMutation(
    trpc.generateLesson.mutationOptions({
      onSuccess: () => {
        // Navigate immediately — the lesson page renders a pending state and
        // listens for `lessonReady` realtime events.
        onNavigate();
        router.push(`/lessons/${lesson.id}`);
      },
      onError: (err) => toast.error(err.message ?? "Failed to start generation"),
    }),
  );

  const isReady = lesson.status === "READY";
  const isGenerating = lesson.status === "GENERATING" || generate.isPending;
  const isFailed = lesson.status === "FAILED";

  // Single button class so the desktop/inline and mobile/below variants stay
  // visually identical apart from sizing. `w-3/4` honours the 75% mobile
  // request; `sm:w-auto` snaps back to natural width once the row goes
  // horizontal.
  const buttonClass = "w-3/4 cursor-pointer sm:w-auto";

  const button = isReady ? (
    <Button
      asChild
      size="sm"
      variant="outline"
      className={buttonClass}
      onClick={onNavigate}
    >
      <Link href={`/lessons/${lesson.id}`}>
        Open
        <ArrowRightIcon className="size-3.5" />
      </Link>
    </Button>
  ) : isGenerating ? (
    <Button
      asChild
      size="sm"
      variant="outline"
      className={buttonClass}
      onClick={onNavigate}
    >
      <Link href={`/lessons/${lesson.id}`}>
        <Loader2Icon className="size-3.5 animate-spin" />
        Generating
      </Link>
    </Button>
  ) : (
    <Button
      type="button"
      size="sm"
      variant={isFailed ? "destructive" : "default"}
      className={buttonClass}
      disabled={generate.isPending}
      onClick={() => generate.mutate({ lessonId: lesson.id })}
    >
      {isFailed ? (
        <>
          <RefreshCwIcon className="size-3.5" />
          Retry
        </>
      ) : (
        <>
          <SparklesIcon className="size-3.5" />
          Generate
        </>
      )}
    </Button>
  );

  // Layout:
  //   - <sm: stack vertically. Header row holds the lesson title/desc and the
  //     activity badge; the action button drops to its own centered row.
  //   - sm+: original single-row layout with title/desc on the left, badge +
  //     button on the right.
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3 sm:flex-1 sm:items-center">
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-start justify-between gap-2 sm:items-center">
            <span className="min-w-0 break-words text-sm font-medium">
              {lesson.title}
            </span>
            {/* Badge sits inline with the title on mobile so the description
                gets the full row width below; on desktop the badge moves to
                the trailing action group instead. */}
            <Badge
              variant="secondary"
              className="shrink-0 capitalize sm:hidden"
            >
              {lesson.activityType.toLowerCase()}
            </Badge>
          </div>
          <span className="line-clamp-2 break-words text-xs text-muted-foreground">
            {lesson.description}
          </span>
        </div>
      </div>
      <div className="flex w-full items-center justify-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
        <Badge
          variant="secondary"
          className="hidden shrink-0 capitalize sm:inline-flex"
        >
          {lesson.activityType.toLowerCase()}
        </Badge>
        {button}
      </div>
    </div>
  );
}
