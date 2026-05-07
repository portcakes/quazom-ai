"use client";

import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { ScrollArea } from "@quazom-ai/ui/components/ui/scroll-area";
import { SearchIcon } from "lucide-react";
import type { CurriculumResource } from "@/inngest/schemas";

type Props = {
  resources: CurriculumResource[];
};

export function ResourcesTab({ resources }: Props) {
  if (resources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No recommended resources yet.</p>
    );
  }

  return (
    <ScrollArea className="max-h-[70vh] pr-3 pb-4">
      <ul className="flex flex-col gap-3">
        {resources.map((resource) => (
          <li
            key={`${resource.type}-${resource.title}`}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-heading text-lg font-semibold leading-snug">
                {resource.title}
              </h3>
              <Badge variant="secondary" className="capitalize shrink-0">
                {resource.type}
              </Badge>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Description
              </span>
              <p className="text-sm leading-relaxed">{resource.reason}</p>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Search For
              </span>
              <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 font-mono text-sm">
                <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{resource.searchQuery}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
