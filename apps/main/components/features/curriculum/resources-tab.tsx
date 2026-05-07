"use client";

import { Badge } from "@quazom-ai/ui/components/ui/badge";
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
    <ul className="flex flex-col gap-3">
      {resources.map((resource) => (
        <li
          key={`${resource.type}-${resource.title}`}
          className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <h3 className="min-w-0 font-heading text-lg font-semibold leading-snug">
              {resource.title}
            </h3>
            <Badge variant="secondary" className="shrink-0 capitalize">
              {resource.type}
            </Badge>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Description
            </span>
            <p className="text-sm leading-relaxed">{resource.reason}</p>
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Search For
            </span>
            <a href={`https://www.google.com/search?q=${resource.searchQuery}`} target="_blank" rel="noopener noreferrer">
              <p className="flex min-w-0 items-center gap-2 rounded-md bg-muted px-3 py-2 font-mono text-sm">
                <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{resource.searchQuery}</span>
              </p>
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
