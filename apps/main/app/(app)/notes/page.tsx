import { requireAuth } from "@/lib/auth-utils";
import { NotesGrid } from "@/components/features/notes/notes-grid";
import { ContinuityNotesGrid } from "@/components/features/continuity-notes/continuity-notes-grid";

export const metadata = {
  title: "Quazom - Your Notes",
  description: "Every note you've written across your curricula, lessons, and free-form thoughts",
};

export default async function NotesPage() {
  await requireAuth();

  return (
    <div className="flex min-w-0 flex-col">
      <section className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-6 md:gap-4 md:py-12">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Your Notes
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            Every note you&apos;ve written across your curricula, lessons, and
            free-form thoughts. Click any note to edit.
          </p>
        </div>
      </section>
      {/* Continuity Notes get top billing — they're the long-form notebooks
          that tie everything together, and we want them in front of the
          smaller per-lesson notes/annotations list below. */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-8">
        <ContinuityNotesGrid />
      </section>
      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <NotesGrid useBottomSheet />
      </section>
    </div>
  );
}
