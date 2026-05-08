import { requireAuth } from "@/lib/auth-utils";
import { NotesWidget } from "@/components/features/notes/notes-widget";
import { ScheduleWidget } from "@/components/features/schedule/schedule-widget";

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
            Track today&apos;s study sessions, build a streak, and capture
            anything on your mind.
          </p>
        </div>
      </section>
      <section className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ScheduleWidget />
          <NotesWidget />
        </div>
      </section>
    </div>
  );
}
