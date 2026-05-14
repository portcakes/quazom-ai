"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LibraryIcon, PlusIcon } from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { cn } from "@quazom-ai/ui/lib/utils";
import { useTRPC } from "@/trpc/client";
import { ResourceCard } from "./resource-card";
import { AddResourceDialog } from "./add-resource-dialog";

type Filter = "ALL" | "LINK" | "PDF" | "TXT" | "MD";

type Props = {
  /** Filter to resources attached to this curriculum (and its lessons). */
  curriculumId?: string;
  /** Filter to resources attached to this lesson only. */
  lessonId?: string;
  /** Friendly label shown in the Add Resource dialog. */
  scopeLabel?: string;
  heading?: React.ReactNode;
  /** Compact 1-column layout for narrow contexts. */
  singleColumn?: boolean;
  /** Override empty state copy. */
  emptyTitle?: string;
  emptyDescription?: string;
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "LINK", label: "Links" },
  { id: "PDF", label: "PDF" },
  { id: "TXT", label: "TXT" },
  { id: "MD", label: "MD" },
];

export function ResourcesGrid({
  curriculumId,
  lessonId,
  scopeLabel,
  heading,
  singleColumn,
  emptyTitle = "No resources yet",
  emptyDescription = "Upload a file or save a link to start your collection.",
}: Props) {
  const trpc = useTRPC();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const input = useMemo(
    () => ({
      ...(curriculumId ? { curriculumId } : {}),
      ...(lessonId ? { lessonId } : {}),
      ...(filter !== "ALL" ? { filter } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
    [curriculumId, lessonId, filter, search],
  );

  // Poll while any resource is still PENDING so the card flips from
  // "Uploading" to "Ready" without a manual refresh. Five seconds is brisk
  // enough that the UI feels live, slow enough to be polite.
  const resourcesQuery = useQuery(
    trpc.listResources.queryOptions(input, {
      refetchInterval: (query) => {
        const rows = query.state.data ?? [];
        return rows.some((r) => r.status === "PENDING") ? 5000 : false;
      },
    }),
  );

  const rows = resourcesQuery.data ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">{heading}</div>
        <div className="flex items-center gap-2">
          {rows.length > 0 ? (
            <Input
              type="search"
              placeholder="Search resources…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full sm:w-56"
            />
          ) : null}
          <Button
            type="button"
            size="sm"
            className="cursor-pointer shrink-0"
            onClick={() => setDialogOpen(true)}
          >
            <PlusIcon className="size-4" />
            Add resource
          </Button>
        </div>
      </div>

      <div className="-mb-1 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <Badge
            key={f.id}
            variant={filter === f.id ? "default" : "outline"}
            className="cursor-pointer select-none"
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </Badge>
        ))}
      </div>

      {resourcesQuery.isLoading ? (
        <ResourcesSkeleton singleColumn={singleColumn} />
      ) : rows.length === 0 ? (
        <ResourcesEmptyState
          title={search ? "No matches" : emptyTitle}
          description={
            search ? "Try a different search term." : emptyDescription
          }
          onAdd={() => setDialogOpen(true)}
          showAdd={!search}
        />
      ) : (
        <ul
          className={
            singleColumn
              ? "flex flex-col gap-2"
              : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          }
        >
          {rows.map((row) => (
            <li key={row.id} className="min-w-0">
              <ResourceCard
                resource={{
                  ...row,
                  // tRPC serialises Date→string at the boundary, the card
                  // handles either via `Date | string`.
                }}
                singleColumn={singleColumn}
              />
            </li>
          ))}
        </ul>
      )}

      <AddResourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        scope={{
          ...(curriculumId ? { curriculumId } : {}),
          ...(lessonId ? { lessonId } : {}),
        }}
        scopeLabel={scopeLabel}
      />
    </section>
  );
}

function ResourcesEmptyState({
  title,
  description,
  onAdd,
  showAdd,
}: {
  title: string;
  description: string;
  onAdd: () => void;
  showAdd: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
      <LibraryIcon className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="font-heading text-base font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {showAdd ? (
        <Button size="sm" className="cursor-pointer" onClick={onAdd}>
          <PlusIcon className="size-4" />
          Add resource
        </Button>
      ) : null}
    </div>
  );
}

function ResourcesSkeleton({ singleColumn }: { singleColumn?: boolean }) {
  const placeholders = Array.from({ length: singleColumn ? 3 : 6 });
  return (
    <ul
      className={cn(
        singleColumn
          ? "flex flex-col gap-2"
          : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {placeholders.map((_, i) => (
        <li
          key={i}
          className={cn(
            "animate-pulse rounded-xl border border-border bg-card/60",
            singleColumn ? "h-20" : "aspect-[3/2]",
          )}
        />
      ))}
    </ul>
  );
}
