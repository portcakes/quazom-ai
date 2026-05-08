import { requireAuth } from "@/lib/auth-utils";
import { SchedulePageClient } from "@/components/features/schedule/schedule-page-client";

export const metadata = {
  title: "Schedule",
};

export default async function SchedulePage() {
  await requireAuth();

  return (
    <div className="flex min-w-0 flex-col">
      <section className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-6 md:gap-4 md:py-12">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Your Study Schedule
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            Every session across your curricula, in one calendar. Click a day
            to see what&apos;s on deck.
          </p>
        </div>
      </section>
      <section className="mx-auto w-full max-w-5xl px-6 py-8">
        <SchedulePageClient />
      </section>
    </div>
  );
}
