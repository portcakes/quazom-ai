"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Loader2Icon,
  ScrollIcon,
  ScrollTextIcon,
  StickyNoteIcon,
} from "lucide-react";
import { useSidebar } from "@quazom-ai/ui/components/ui/sidebar";
import { cn } from "@quazom-ai/ui/lib/utils";
import { useContinuityNotes } from "./continuity-note-provider";

/**
 * Sidebar section that lists the user's Continuity Notes and surfaces the
 * "Create Continuity Notes" entry point. Sits underneath the curriculum
 * list on the app sidebar.
 */
export function ContinuityNotesSection() {
  const { notes, createAndOpen, openNote, activeNoteId } = useContinuityNotes();
  const { isMobile, setOpenMobile } = useSidebar();
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      if (isMobile) setOpenMobile(false);
      await createAndOpen();
    } finally {
      setCreating(false);
    }
  };

  const handleOpen = (id: string) => {
    if (isMobile) setOpenMobile(false);
    openNote(id);
  };

  return (
    <div className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Continuity Notes
      </h2>
      <ul className="flex flex-col gap-2">
        <li>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-sidebar-border bg-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:border-sidebar-accent disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {creating ? (
              <Loader2Icon className="size-4 shrink-0 animate-spin" />
            ) : (
              <ScrollIcon className="size-4 shrink-0" />
            )}
            <span className="truncate">
              {creating ? "Creating…" : "Create Continuity Notes"}
            </span>
          </button>
        </li>
        {notes.map((note) => {
          const isActive = note.id === activeNoteId;
          const title = note.title?.trim() || "Untitled note";
          return (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => handleOpen(note.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg bg-card px-3 py-2 text-left text-sm ring-1 ring-foreground/10 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer",
                  isActive &&
                    "bg-sidebar-accent text-sidebar-accent-foreground ring-foreground/20",
                )}
              >
                <ScrollTextIcon className="size-4 shrink-0" />
                <span className="truncate">{title}</span>
              </button>
            </li>
          );
        })}
        {/* Mirror of the "See all Curricula" affordance under the
            course list, so the sidebar always exposes a way to jump to
            the dedicated /notes surface where both Continuity Notes and
            the regular notes grid live. */}
        <li className="mt-1">
          <Link
            href="/notes"
            onClick={() => {
              if (isMobile) setOpenMobile(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <StickyNoteIcon className="size-4 shrink-0" />
            <span className="truncate">See all Notes</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
