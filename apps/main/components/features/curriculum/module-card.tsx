"use client";

import { useState } from "react";
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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@quazom-ai/ui/components/ui/hover-card";
import type { CurriculumModule } from "@/inngest/schemas";

type Props = {
  module: CurriculumModule;
  index: number;
};

export function ModuleCard({ module, index }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:bg-sidebar-accent/40 hover:ring-1 hover:ring-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-sm font-medium text-muted-foreground">
                {index + 1}
              </span>
              <h3 className="truncate font-heading text-lg font-semibold">{module.title}</h3>
            </div>
            <Badge variant="outline" className="shrink-0">
              {module.lessons.length} {module.lessons.length === 1 ? "lesson" : "lessons"}
            </Badge>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{module.summary}</p>
          {module.objectives.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {module.objectives.map((objective) => (
                <Badge key={objective} variant="secondary" className="font-normal">
                  {objective}
                </Badge>
              ))}
            </div>
          ) : null}
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{module.title}</DialogTitle>
          <DialogDescription>{module.summary}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lessons
          </h4>
          {module.lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lessons listed for this module.</p>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-3">
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {module.lessons.map((lesson, i) => (
                  <li key={`${i}-${lesson.title}`}>
                    <HoverCard openDelay={150} closeDelay={75}>
                      <HoverCardTrigger asChild>
                        <div className="flex items-center justify-between gap-3 px-4 py-3 cursor-default">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="font-mono text-xs text-muted-foreground tabular-nums">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="truncate text-sm font-medium">{lesson.title}</span>
                          </div>
                          <Badge variant="secondary" className="shrink-0 capitalize">
                            {lesson.activityType}
                          </Badge>
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent side="left" className="w-80">
                        <p className="text-sm leading-relaxed">{lesson.description}</p>
                      </HoverCardContent>
                    </HoverCard>
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
