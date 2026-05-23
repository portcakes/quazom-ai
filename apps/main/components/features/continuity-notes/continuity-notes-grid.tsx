"use client";

import { useMemo, useState } from "react";
import { Loader2Icon, PlusIcon, ScrollIcon, ScrollTextIcon } from "lucide-react";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { cn } from "@quazom-ai/ui/lib/utils";
import { useContinuityNotes } from "./continuity-note-provider";

const TAGS_PREVIEW_LIMIT = 4;

/**
 * Card grid that mirrors the sidebar's Continuity Notes list, surfaced
 * on the /notes page above the lesson/curriculum notes grid. Clicking a
 * card opens the same split-screen editor panel that the sidebar uses
 * (via `openNote` from the existing provider), so this stays purely a
 * UI surface — no new state, no new server round-trips.
 *
 * Search is client-side over the title + tags fields (the body content
 * isn't in the list payload). Mirrors the pattern in
 * `notes-grid.tsx` for consistency.
 */
export function ContinuityNotesGrid() {
  const { notes, openNote, createAndOpen, activeNoteId } = useContinuityNotes();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      await createAndOpen();
    } finally {
      setCreating(false);
    }
  };

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((note) => {
      const haystack = `${note.title ?? ""} ${(note.tags ?? []).join(" ")}`
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [notes, search]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Continuity Notes
          </h2>
          <p className="text-sm text-muted-foreground">
            Long-form learner notebooks that link across courses, lessons,
            and resources. Click any note to open it in the side panel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {notes.length > 0 && (
            <Input
              type="search"
              placeholder="Search continuity notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full sm:w-56"
            />
          )}
          <Button
            type="button"
            size="sm"
            className="cursor-pointer shrink-0"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <PlusIcon className="size-4" />
            )}
            {creating ? "Creating…" : "New Continuity Note"}
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <ContinuityNotesEmptyState
          onCreate={handleCreate}
          creating={creating}
        />
      ) : filteredNotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          No notes match <span className="font-medium">&ldquo;{search}&rdquo;</span>.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredNotes.map((note) => {
            const isActive = note.id === activeNoteId;
            const title = note.title?.trim() || "Untitled note";
            const tags = note.tags ?? [];
            const previewTags = tags.slice(0, TAGS_PREVIEW_LIMIT);
            const extraTags = tags.length - previewTags.length;
            return (
              <li key={note.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => openNote(note.id)}
                  className={cn(
                    "group flex aspect-square w-full min-w-0 flex-col items-stretch gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-sidebar-accent/40 hover:ring-1 hover:ring-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
                    isActive &&
                      "border-primary bg-sidebar-accent/40 ring-1 ring-foreground/15",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <ScrollTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <h3 className="min-w-0 break-words font-heading text-base font-semibold leading-snug line-clamp-2">
                        {title}
                      </h3>
                    </div>
                    <time
                      dateTime={note.updatedAt}
                      className="shrink-0 text-[11px] text-muted-foreground tabular-nums"
                      title={new Date(note.updatedAt).toLocaleString()}
                    >
                      {formatRelative(new Date(note.updatedAt))}
                    </time>
                  </div>
                  {previewTags.length > 0 ? (
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {previewTags.map((tag) => (
                        <li key={tag}>
                          <Badge
                            variant="outline"
                            className="px-1.5 py-0 text-[10px] font-medium"
                          >
                            #{tag}
                          </Badge>
                        </li>
                      ))}
                      {extraTags > 0 ? (
                        <li>
                          <Badge
                            variant="outline"
                            className="px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
                          >
                            +{extraTags}
                          </Badge>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                  <p className="mt-auto text-xs text-muted-foreground">
                    Continuity note
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ContinuityNotesEmptyState({
  onCreate,
  creating,
}: {
  onCreate: () => Promise<void> | void;
  creating: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
      <ScrollIcon className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="font-heading text-base font-medium">
          No Continuity Notes yet
        </p>
        <p className="text-sm text-muted-foreground">
          Start a long-form notebook that follows you across every lesson,
          course, and resource.
        </p>
      </div>
      <Button
        size="sm"
        className="cursor-pointer"
        onClick={() => {
          void onCreate();
        }}
        disabled={creating}
      >
        {creating ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <PlusIcon className="size-4" />
        )}
        New Continuity Note
      </Button>
    </div>
  );
}

const RELATIVE_DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] =
  [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 7, unit: "day" },
    { amount: 4.345, unit: "week" },
    { amount: 12, unit: "month" },
    { amount: Number.POSITIVE_INFINITY, unit: "year" },
  ];

function formatRelative(date: Date): string {
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  let duration = (date.getTime() - Date.now()) / 1000;
  for (const div of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < div.amount) {
      return formatter.format(Math.round(duration), div.unit);
    }
    duration /= div.amount;
  }
  return date.toLocaleDateString();
}
