"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { format } from "date-fns";
import { CalendarIcon, PlusIcon } from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { CreateScheduleModal } from "./create-schedule-modal";
import { ScheduleCalendar } from "./schedule-calendar";
import { StreakBadge } from "./streak-badge";
import {
  DAYS_OF_WEEK,
  STUDY_TIME_SLOT_META,
  type StudyTimeSlot,
} from "@/lib/schedule/time-slots";

export function SchedulePageClient() {
  const trpc = useTRPC();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: schedules, isLoading } = useQuery(
    trpc.listSchedules.queryOptions(),
  );

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted/40" />;
  }

  const hasSchedules = (schedules?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <StreakBadge />
        <Button
          type="button"
          size="sm"
          className="cursor-pointer"
          onClick={() => setModalOpen(true)}
        >
          <PlusIcon className="size-4" />
          New schedule
        </Button>
      </div>

      {hasSchedules ? (
        <>
          <ScheduleCalendar />
          <ScheduleSummaryGrid schedules={schedules ?? []} />
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
          <CalendarIcon className="size-10 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <p className="font-heading text-lg font-medium">
              No active schedules
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              Pick a curriculum and we&apos;ll pace lessons across your study
              window. You can run multiple schedules at once — we&apos;ll
              prevent the AI from putting two curricula in the same time slot.
            </p>
          </div>
          <Button
            type="button"
            className="cursor-pointer"
            onClick={() => setModalOpen(true)}
          >
            <PlusIcon className="size-4" />
            Create your first schedule
          </Button>
        </div>
      )}

      <CreateScheduleModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}

function ScheduleSummaryGrid({
  schedules,
}: {
  schedules: ScheduleListItem[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-semibold tracking-tight">
        Active schedules
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {schedules.map((s) => (
          <li
            key={s.id}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card/40 p-4"
          >
            <Link
              href={`/curricula/${s.curriculumId}`}
              className="font-heading text-base font-semibold hover:underline"
            >
              {s.curriculumTitle}
            </Link>
            <div className="text-xs text-muted-foreground">
              {DAYS_OF_WEEK.filter((d) => s.daysOfWeek.includes(d.value))
                .map((d) => d.short)
                .join(" · ")}{" "}
              · {s.minutesPerDay} min/day
            </div>
            <div className="text-xs text-muted-foreground">
              {(s.preferredTimeSlots as StudyTimeSlot[])
                .map((slot) => STUDY_TIME_SLOT_META[slot].label)
                .join(", ")}
            </div>
            <div className="text-xs text-muted-foreground">
              Until {format(new Date(s.targetCompletionDate), "MMM d, yyyy")} ·
              {" "}{s.sessionCount} sessions
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

type ScheduleListItem = {
  id: string;
  curriculumId: string;
  curriculumTitle: string;
  daysOfWeek: number[];
  minutesPerDay: number;
  preferredTimeSlots: string[];
  startDate: Date | string;
  targetCompletionDate: Date | string;
  warningsAccepted: boolean;
  sessionCount: number;
};
