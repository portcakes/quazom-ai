"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, StickyNoteIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { NoteCard } from "./note-card";
import { NoteEditorDialog } from "./note-editor-dialog";
import { NoteBottomSheet } from "./note-bottom-sheet";

type Props = {
  /** Filter notes to those scoped to a specific curriculum (or its lessons). */
  curriculumId?: string;
  /** Filter notes to those attached to a specific lesson. */
  lessonId?: string;
  /** Restrict to free-form notes when no other filter is set. */
  scope?: "all" | "user";
  /** When set, the New Note button creates a note pre-attached to this curriculum. */
  newNoteCurriculumId?: string;
  /** When set, the New Note button creates a note pre-attached to this lesson. */
  newNoteLessonId?: string;
  /** Override the empty-state copy. */
  emptyTitle?: string;
  emptyDescription?: string;
  /** Hide the search input (e.g. for tight in-lesson contexts). */
  hideSearch?: boolean;
  /** Heading shown above the list. */
  heading?: React.ReactNode;
  /** Compact 1-column layout for narrow contexts. */
  singleColumn?: boolean;
  /**
   * Use the bottom-sheet composer (markdown editor + summarize) instead of
   * the legacy modal dialog. Lesson contexts and the main /notes page set
   * this; the homepage widget defaults to the dialog so it stays light.
   */
  useBottomSheet?: boolean;
};

export function NotesGrid({
  curriculumId,
  lessonId,
  scope,
  newNoteCurriculumId,
  newNoteLessonId,
  emptyTitle = "No notes yet",
  emptyDescription = "Capture a thought to get started.",
  hideSearch,
  heading,
  singleColumn,
  useBottomSheet,
}: Props) {
  const trpc = useTRPC();
  const [editorOpen, setEditorOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filterInput = useMemo(
    () => ({
      ...(curriculumId ? { curriculumId } : {}),
      ...(lessonId ? { lessonId } : {}),
      ...(scope ? { scope } : {}),
    }),
    [curriculumId, lessonId, scope],
  );

  const notesQuery = useQuery(trpc.listNotes.queryOptions(filterInput));

  const notes = useMemo(() => {
    const items = notesQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((n) => {
      const haystack = `${n.title ?? ""} ${n.content}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [notesQuery.data, search]);

  return (
    <section className="flex flex-col gap-4">
      {(heading || !hideSearch) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {heading}
          </div>
          <div className="flex items-center gap-2">
            {!hideSearch && (notesQuery.data?.length ?? 0) > 0 && (
              <Input
                type="search"
                placeholder="Search notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full sm:w-56"
              />
            )}
            <Button
              type="button"
              size="sm"
              className="cursor-pointer shrink-0"
              onClick={() => setEditorOpen(true)}
            >
              <PlusIcon className="size-4" />
              New note
            </Button>
          </div>
        </div>
      )}

      {notesQuery.isLoading ? (
        <NotesSkeleton singleColumn={singleColumn} />
      ) : notes.length === 0 ? (
        <NotesEmptyState
          title={search ? "No matches" : emptyTitle}
          description={
            search
              ? "Try a different search term."
              : emptyDescription
          }
          onCreate={() => setEditorOpen(true)}
          showCreate={!search}
        />
      ) : (
        <ul
          className={
            singleColumn
              ? "flex flex-col gap-3"
              : // Uniform medium-square tiles. The grid scales the column
                // count with viewport width but each tile keeps its 1:1
                // aspect so the page stays visually rhythmic.
                "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          }
        >
          {notes.map((note) =>
            singleColumn ? (
              <li key={note.id} className="min-w-0">
                <SingleColumnNoteRow note={note} />
              </li>
            ) : (
              <li key={note.id} className="min-w-0">
                <NoteCard note={note} />
              </li>
            ),
          )}
        </ul>
      )}

      {useBottomSheet ? (
        <NoteBottomSheet
          open={editorOpen}
          onOpenChange={setEditorOpen}
          curriculumId={newNoteCurriculumId ?? null}
          lessonId={newNoteLessonId ?? null}
        />
      ) : (
        <NoteEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          defaultCurriculumId={newNoteCurriculumId ?? null}
          defaultLessonId={newNoteLessonId ?? null}
        />
      )}
    </section>
  );
}

// In single-column contexts (homepage widget, lesson side panel) we keep the
// list dense — a slim row instead of a square — so it fits next to other
// content. Clicking still opens the dedicated note page.
function SingleColumnNoteRow({
  note,
}: {
  note: {
    id: string;
    title: string | null;
    description?: string | null;
    content: string;
    updatedAt: Date | string;
  };
}) {
  const updated =
    typeof note.updatedAt === "string"
      ? new Date(note.updatedAt)
      : note.updatedAt;
  return (
    <Link
      href={`/notes/${note.id}`}
      className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-sidebar-accent/40 hover:ring-1 hover:ring-foreground/10"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="min-w-0 truncate font-heading text-sm font-semibold">
          {note.title?.trim() || "Untitled note"}
        </h4>
        <time className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
          {updated.toLocaleDateString()}
        </time>
      </div>
      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {note.description?.trim() || stripQuickPreview(note.content)}
      </p>
    </Link>
  );
}

function stripQuickPreview(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function NotesEmptyState({
  title,
  description,
  onCreate,
  showCreate,
}: {
  title: string;
  description: string;
  onCreate: () => void;
  showCreate: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
      <StickyNoteIcon className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="font-heading text-base font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {showCreate ? (
        <Button size="sm" className="cursor-pointer" onClick={onCreate}>
          <PlusIcon className="size-4" />
          New note
        </Button>
      ) : null}
    </div>
  );
}

function NotesSkeleton({ singleColumn }: { singleColumn?: boolean }) {
  const placeholders = Array.from({ length: singleColumn ? 3 : 8 });
  return (
    <ul
      className={
        singleColumn
          ? "flex flex-col gap-3"
          : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      }
    >
      {placeholders.map((_, i) => (
        <li
          key={i}
          className={
            singleColumn
              ? "h-16 animate-pulse rounded-lg border border-border bg-card/60"
              : "aspect-square animate-pulse rounded-xl border border-border bg-card/60"
          }
        />
      ))}
    </ul>
  );
}
