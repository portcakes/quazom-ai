"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isSameDay, startOfDay } from "date-fns";
import {
  CalendarIcon,
  ClockIcon,
  PlusIcon,
  ArrowRightIcon,
} from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { cn } from "@quazom-ai/ui/lib/utils";
import { useTRPC } from "@/trpc/client";
import { CreateScheduleModal } from "./create-schedule-modal";
import { StreakBadge } from "./streak-badge";
import { STUDY_TIME_SLOT_META } from "@/lib/schedule/time-slots";

/**
 * Compact homepage widget. Two states:
 *
 *   1. No schedules → CTA card with "Create Study Schedule" button.
 *   2. Has schedules → today + next-up sessions, streak chip, link to /schedule.
 */
export function ScheduleWidget() {
  const trpc = useTRPC();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: schedules, isLoading: schedulesLoading } = useQuery(
    trpc.listSchedules.queryOptions(),
  );

  // Pull the next 14 days of sessions so we can render "today" + a small
  // "up next" tail without a separate query.
  const now = useMemo(() => startOfDay(new Date()), []);
  const horizon = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + 14);
    return d;
  }, [now]);

  const { data: sessions } = useQuery({
    ...trpc.sessionsInRange.queryOptions({
      from: now.toISOString(),
      to: horizon.toISOString(),
    }),
    enabled: (schedules?.length ?? 0) > 0,
  });

  if (schedulesLoading) {
    return (
      <WidgetShell>
        <div className="h-32 animate-pulse rounded-md bg-muted/40" />
      </WidgetShell>
    );
  }

  if (!schedules || schedules.length === 0) {
    return (
      <WidgetShell>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card/40 px-4 py-8 text-center">
          <CalendarIcon className="size-8 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <p className="font-heading text-base font-medium">
              No study schedule yet
            </p>
            <p className="text-sm text-muted-foreground">
              Pace your curricula and build a daily streak.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            onClick={() => setModalOpen(true)}
          >
            <PlusIcon className="size-4" />
            Create study schedule
          </Button>
        </div>
        <CreateScheduleModal open={modalOpen} onOpenChange={setModalOpen} />
      </WidgetShell>
    );
  }

  const todaySessions = (sessions ?? []).filter((s) =>
    isSameDay(new Date(s.date), now),
  );
  const upcomingSessions = (sessions ?? [])
    .filter((s) => !isSameDay(new Date(s.date), now))
    .slice(0, 3);

  return (
    <WidgetShell>
      <div className="flex flex-col gap-4">
        <Section title="Today">
          {todaySessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing scheduled today. Check back tomorrow or
              <Link
                href="/schedule"
                className="ml-1 font-medium text-foreground underline underline-offset-4"
              >
                view your full schedule
              </Link>
              .
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {todaySessions.map((s) => (
                <SessionPreview key={s.id} session={s} />
              ))}
            </ul>
          )}
        </Section>
        {upcomingSessions.length > 0 && (
          <Section title="Up next">
            <ul className="flex flex-col gap-2">
              {upcomingSessions.map((s) => (
                <SessionPreview key={s.id} session={s} showDate />
              ))}
            </ul>
          </Section>
        )}
        <Link
          href="/schedule"
          className="inline-flex items-center gap-1 self-start text-sm font-medium text-foreground hover:underline"
        >
          View calendar
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    </WidgetShell>
  );
}

function WidgetShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Schedule
        </h2>
        <StreakBadge />
      </header>
      <div className="rounded-xl border border-border bg-card/30 p-4">
        {children}
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

type SessionItem = {
  id: string;
  date: string | Date;
  timeSlot: keyof typeof STUDY_TIME_SLOT_META;
  durationMin: number;
  lessonIds: string[];
  lessonTitles: string[];
  isCompleted: boolean;
  curriculum: { id: string; title: string };
};

function SessionPreview({
  session,
  showDate,
}: {
  session: SessionItem;
  showDate?: boolean;
}) {
  const date = new Date(session.date);
  const slot = STUDY_TIME_SLOT_META[session.timeSlot];
  return (
    <li
      className={cn(
        "rounded-lg border border-border p-3",
        session.isCompleted ? "bg-emerald-500/5" : "bg-background",
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ClockIcon className="size-3.5" />
          {showDate ? `${format(date, "EEE MMM d")} · ` : ""}
          {slot.label} · {session.durationMin}m
        </span>
        <Link
          href={`/curricula/${session.curriculum.id}`}
          className="truncate font-semibold text-foreground hover:underline"
        >
          {session.curriculum.title}
        </Link>
      </div>
      <ul className="mt-1.5 flex flex-col gap-0.5">
        {session.lessonIds.map((lessonId, i) => (
          <li key={lessonId}>
            <Link
              href={`/lessons/${lessonId}`}
              className="block truncate rounded text-sm hover:underline"
            >
              {session.lessonTitles[i] ?? "Lesson"}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}
