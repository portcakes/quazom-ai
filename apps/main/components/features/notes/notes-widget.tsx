"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { NotesGrid } from "./notes-grid";

/**
 * Homepage widget for free-form notes. The list is intentionally compact
 * (single column, no search) so the schedule widget can sit next to it on
 * wider screens. The "View all notes" link drops the user on the dedicated
 * /notes page when they want the full grid.
 */
export function NotesWidget() {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Notes
        </h2>
        <Link
          href="/notes"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          View all
          <ArrowRightIcon className="size-4" />
        </Link>
      </header>
      <div className="rounded-xl border border-border bg-card/30 p-4">
        <NotesGrid
          scope="user"
          singleColumn
          hideSearch
          emptyTitle="No quick notes yet"
          emptyDescription="Jot down a thought about anything you're studying."
        />
      </div>
    </section>
  );
}
