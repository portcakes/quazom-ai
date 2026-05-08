"use client";

import { NotesGrid } from "../notes/notes-grid";

type Props = {
  lessonId: string;
  curriculumId: string;
  /** Section heading. Defaults to a stylized H3. */
  title?: string;
  /** Subhead under the title. */
  description?: string;
};

/**
 * In-lesson notes block. Used inside Quiz/Exercise/Reading views per spec.
 * Surfaces existing lesson notes and creates new ones already linked to the
 * lesson (and, transitively, the curriculum so the Notes tab aggregates them).
 */
export function LessonNotesPanel({
  lessonId,
  curriculumId,
  title = "Your notes for this lesson",
  description = "Notes you take here also appear on your Notes page and the curriculum's Notes tab.",
}: Props) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-5">
      <header>
        <h3 className="font-heading text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      <NotesGrid
        lessonId={lessonId}
        newNoteLessonId={lessonId}
        newNoteCurriculumId={curriculumId}
        singleColumn
        hideSearch
        emptyTitle="No notes for this lesson"
        emptyDescription="Capture a question, observation, or summary as you work through it."
      />
    </section>
  );
}
