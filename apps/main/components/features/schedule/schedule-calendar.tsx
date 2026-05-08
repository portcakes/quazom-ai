"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, format, isSameDay, startOfMonth } from "date-fns";
import { CheckCircle2Icon, ClockIcon } from "lucide-react";
import { Calendar } from "@quazom-ai/ui/components/ui/calendar";
import { cn } from "@quazom-ai/ui/lib/utils";
import { useTRPC } from "@/trpc/client";
import {
  STUDY_TIME_SLOT_META,
  type StudyTimeSlot,
} from "@/lib/schedule/time-slots";

type Props = {
  /** When set, sessions are filtered to a single curriculum. */
  curriculumId?: string;
  /** When set, hide the curriculum chip on session rows (parent already shows it). */
  hideCurriculumLabel?: boolean;
  className?: string;
};

/**
 * Reusable monthly calendar that surfaces:
 *   - Days with sessions: ring + dot indicator (count of sessions in tooltip).
 *   - Days the user checked in: emerald background + check icon.
 *   - Selected day: shows session details below the grid.
 *
 * Used on the dedicated /schedule page, the curriculum tab, and the home
 * widget. The grid shows one month at a time; sessions are paged by month
 * via `sessionsInRange`.
 */
export function ScheduleCalendar({
  curriculumId,
  hideCurriculumLabel,
  className,
}: Props) {
  const trpc = useTRPC();
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(() => new Date());

  const monthStart = startOfMonth(month);
  // Pad the bounds by a week on either side so the visible calendar grid
  // (which always shows partial weeks) is fully populated.
  const from = new Date(monthStart);
  from.setDate(from.getDate() - 7);
  const to = new Date(endOfMonth(month));
  to.setDate(to.getDate() + 8);

  const { data: sessions, isLoading } = useQuery(
    trpc.sessionsInRange.queryOptions({
      from: from.toISOString(),
      to: to.toISOString(),
      ...(curriculumId ? { curriculumId } : {}),
    }),
  );

  const { data: streak } = useQuery(trpc.getStreak.queryOptions());

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, ScheduleSessionRow[]>();
    for (const s of sessions ?? []) {
      const key = format(new Date(s.date), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push({
        ...s,
        date: new Date(s.date),
      });
      map.set(key, list);
    }
    return map;
  }, [sessions]);

  // Modifiers feed into react-day-picker's modifier system so we can style
  // study days vs check-in days vs ordinary days from one place.
  const modifiers = useMemo(() => {
    const studyDays: Date[] = [];
    const completedDays: Date[] = [];
    for (const [key, list] of sessionsByDay) {
      const date = parseDayKey(key);
      studyDays.push(date);
      if (list.every((s) => s.isCompleted)) {
        completedDays.push(date);
      }
    }
    // Check-in days (might not have a session — e.g. catch-up streak).
    // We re-fetch streak summary which only carries the count, so derive
    // check-ins from completed sessions for now. The CheckIn rows are also
    // applied to all sessions on that day so this covers the common case.
    return { study: studyDays, completed: completedDays };
  }, [sessionsByDay]);

  const selectedKey = format(selected, "yyyy-MM-dd");
  const selectedSessions = sessionsByDay.get(selectedKey) ?? [];

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="rounded-xl border border-border bg-card/40 p-2">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => d && setSelected(d)}
            month={month}
            onMonthChange={setMonth}
            modifiers={modifiers}
            modifiersClassNames={{
              study:
                "ring-1 ring-primary/40 ring-inset rounded-(--cell-radius)",
              completed:
                "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded-(--cell-radius)",
            }}
            showOutsideDays
          />
        </div>
        <div className="min-w-0 flex-1">
          <SelectedDayPanel
            date={selected}
            sessions={selectedSessions}
            isLoading={isLoading}
            streakIsLive={streak?.checkedInToday ?? false}
            hideCurriculumLabel={hideCurriculumLabel}
          />
        </div>
      </div>

      <Legend />
    </div>
  );
}

type ScheduleSessionRow = {
  id: string;
  scheduleId: string;
  date: Date;
  timeSlot: StudyTimeSlot;
  durationMin: number;
  lessonIds: string[];
  lessonTitles: string[];
  isCompleted: boolean;
  curriculum: { id: string; title: string };
};

function SelectedDayPanel({
  date,
  sessions,
  isLoading,
  streakIsLive,
  hideCurriculumLabel,
}: {
  date: Date;
  sessions: ScheduleSessionRow[];
  isLoading: boolean;
  streakIsLive: boolean;
  hideCurriculumLabel?: boolean;
}) {
  const isToday = isSameDay(date, new Date());

  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card/40 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-heading text-base font-semibold">
          {format(date, "EEEE, MMM d")}
        </h3>
        {isToday && streakIsLive && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2Icon className="size-3" />
            Checked in
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="h-20 animate-pulse rounded-md bg-muted/50" />
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing scheduled for this day.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions
            .slice()
            .sort(
              (a, b) =>
                STUDY_TIME_SLOT_META[a.timeSlot].startHour -
                STUDY_TIME_SLOT_META[b.timeSlot].startHour,
            )
            .map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                hideCurriculumLabel={hideCurriculumLabel}
              />
            ))}
        </ul>
      )}
    </div>
  );
}

function SessionRow({
  session,
  hideCurriculumLabel,
}: {
  session: ScheduleSessionRow;
  hideCurriculumLabel?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border border-border p-3 text-sm",
        session.isCompleted ? "bg-emerald-500/5" : "bg-background",
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <ClockIcon className="size-3.5" />
          {STUDY_TIME_SLOT_META[session.timeSlot].label} · {session.durationMin}m
        </span>
        {session.isCompleted && (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2Icon className="size-3" />
            Done
          </span>
        )}
      </div>
      {!hideCurriculumLabel && (
        <Link
          href={`/curricula/${session.curriculum.id}`}
          className="text-xs font-semibold text-foreground hover:underline"
        >
          {session.curriculum.title}
        </Link>
      )}
      <ul className="flex flex-col gap-1">
        {session.lessonIds.map((lessonId, i) => (
          <li key={lessonId}>
            <Link
              href={`/lessons/${lessonId}`}
              className="block truncate rounded px-2 py-1 hover:bg-muted/60"
            >
              {session.lessonTitles[i] ?? "Lesson"}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-sm ring-1 ring-primary/60 ring-inset" />
        Study session
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-emerald-500/40" />
        Checked in
      </span>
    </div>
  );
}

/** Parse a YYYY-MM-DD string into a local-day Date. */
function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}
