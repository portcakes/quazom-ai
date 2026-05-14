"use client";

import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { SearchIcon } from "lucide-react";
import type { CurriculumResource } from "@/inngest/schemas";
import { ResourcesGrid } from "@/components/features/resources/resources-grid";

type Props = {
  curriculumId: string;
  curriculumTitle: string;
  /** AI-recommended search-style resources from curriculum generation. */
  resources: CurriculumResource[];
};

/**
 * Two stacked sections:
 *   1. "My resources" — user-uploaded files / saved links pinned to this
 *      curriculum (or any of its lessons). Lives in the user's library and
 *      doubles as a place to drop new ones in via the Add Resource button.
 *   2. "Recommended" — the AI's seed list of search queries; unchanged from
 *      the original tab. These aren't owned resources, just pointers.
 */
export function ResourcesTab({
  curriculumId,
  curriculumTitle,
  resources,
}: Props) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <header className="flex flex-col gap-1">
          <h3 className="font-heading text-lg font-semibold">My resources</h3>
          <p className="text-sm text-muted-foreground">
            Files and links you've attached to this curriculum. Open one to
            highlight, quote, or take notes from it.
          </p>
        </header>
        <ResourcesGrid
          curriculumId={curriculumId}
          scopeLabel={curriculumTitle}
          singleColumn
          emptyTitle="No resources attached yet"
          emptyDescription="Upload a PDF or save a link to pin it to this curriculum."
        />
      </section>

      <section className="flex flex-col gap-3">
        <header className="flex flex-col gap-1">
          <h3 className="font-heading text-lg font-semibold">Recommended</h3>
          <p className="text-sm text-muted-foreground">
            Suggested reading and viewing the AI surfaced when this curriculum
            was generated.
          </p>
        </header>
        {resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recommended resources yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {resources.map((resource) => (
              <li
                key={`${resource.type}-${resource.title}`}
                className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <h4 className="min-w-0 font-heading text-base font-semibold leading-snug">
                    {resource.title}
                  </h4>
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
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(resource.searchQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <p className="flex min-w-0 items-center gap-2 rounded-md bg-muted px-3 py-2 font-mono text-sm">
                      <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{resource.searchQuery}</span>
                    </p>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
