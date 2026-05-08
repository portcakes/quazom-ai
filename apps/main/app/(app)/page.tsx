import { requireAuth } from "@/lib/auth-utils";
import { NotesGrid } from "@/components/features/notes/notes-grid";

export default async function Home() {
  const session = await requireAuth();
  const firstName = session.user.name?.split(" ")[0] ?? session.user.name ?? "there";

  return (
    <div className="flex min-w-0 flex-col">
      <section className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-8 md:gap-4 md:py-12">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Welcome back, {firstName}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Capture quick thoughts on what you&apos;re studying. Notes you take
            here are unattached to any curriculum and live in your Notes page.
          </p>
        </div>
      </section>
      <section className="mx-auto w-full max-w-5xl px-6 py-8">
        <NotesGrid
          scope="user"
          emptyTitle="Nothing here yet"
          emptyDescription="Use this space for free-form thoughts about your studies — anything not tied to a specific curriculum."
        />
      </section>
    </div>
  );
}
