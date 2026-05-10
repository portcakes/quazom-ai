"use client";

import { NotesGrid } from "../notes/notes-grid";

type Props = {
  curriculumId: string;
};

export function CurriculumNotesTab({ curriculumId }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="font-heading text-2xl font-semibold">Notes</h2>
        <p className="text-sm text-muted-foreground">
          All notes you&apos;ve taken inside this curriculum, plus any you create
          here directly.
        </p>
      </header>
      <NotesGrid
        curriculumId={curriculumId}
        newNoteCurriculumId={curriculumId}
        useBottomSheet
        emptyTitle="No notes for this curriculum yet"
        emptyDescription="Take notes inside lessons or jot something here — they all show up in this tab."
      />
    </div>
  );
}
