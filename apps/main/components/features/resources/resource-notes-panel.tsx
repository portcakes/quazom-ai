"use client";

import { NotesGrid } from "../notes/notes-grid";

type Props = {
  resourceId: string;
  title?: string;
  description?: string;
};

/** Notes block embedded in the resource viewer. New notes get attached to
 *  the resource so they aggregate under the resource's own notes section
 *  as well as the main /notes page. */
export function ResourceNotesPanel({
  resourceId,
  title = "Your notes for this resource",
  description = "Highlight text in the resource to capture quotes — they save here automatically.",
}: Props) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-5">
      <header>
        <h3 className="font-heading text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      <NotesGrid
        resourceId={resourceId}
        newNoteResourceId={resourceId}
        singleColumn
        hideSearch
        useBottomSheet
        emptyTitle="No notes for this resource"
        emptyDescription="Highlight or annotate to capture your first thought."
      />
    </section>
  );
}
