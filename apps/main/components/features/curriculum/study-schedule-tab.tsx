"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarPlusIcon,
  ClockIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@quazom-ai/ui/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@quazom-ai/ui/components/ui/alert-dialog";
import { useTRPC } from "@/trpc/client";
import { CreateScheduleModal } from "../schedule/create-schedule-modal";
import { ScheduleCalendar } from "../schedule/schedule-calendar";
import { StreakBadge } from "../schedule/streak-badge";
import {
  DAYS_OF_WEEK,
  STUDY_TIME_SLOT_META,
  type StudyTimeSlot,
} from "@/lib/schedule/time-slots";

type Props = {
  curriculumId: string;
  curriculumTitle: string;
};

/**
 * Curriculum-page tab. Shows either the empty CTA, or the schedule's
 * settings summary + a calendar scoped to this curriculum's sessions.
 */
export function StudyScheduleTab({ curriculumId, curriculumTitle }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const { data: schedules, isLoading } = useQuery(
    trpc.listSchedules.queryOptions(),
  );

  const schedule = schedules?.find((s) => s.curriculumId === curriculumId);

  const deleteMutation = useMutation(
    trpc.deleteSchedule.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.listSchedules.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.sessionsInRange.queryKey(),
        });
        toast.success("Schedule removed");
      },
      onError: (error) => {
        toast.error(error.message ?? "Failed to delete schedule");
      },
    }),
  );

  if (isLoading) {
    return <div className="h-32 animate-pulse rounded-xl bg-muted/40" />;
  }

  if (!schedule) {
    return (
      <>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
          <CalendarPlusIcon className="size-8 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <p className="font-heading text-base font-medium">
              No study schedule for this curriculum
            </p>
            <p className="text-sm text-muted-foreground">
              Pick study days, minutes per day, and a target completion date —
              we&apos;ll pace lessons across your study window.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            onClick={() => setModalOpen(true)}
          >
            <CalendarPlusIcon className="size-4" />
            Create study schedule
          </Button>
        </div>
        <CreateScheduleModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          lockedCurriculumId={curriculumId}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {curriculumTitle}
            </p>
            <ScheduleSettingsRow
              daysOfWeek={schedule.daysOfWeek}
              minutesPerDay={schedule.minutesPerDay}
              preferredTimeSlots={schedule.preferredTimeSlots}
              targetCompletionDate={schedule.targetCompletionDate}
              sessionCount={schedule.sessionCount}
            />
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <StreakBadge />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setModalOpen(true)}
            >
              <PencilIcon className="size-3.5" />
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer text-destructive hover:text-destructive"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              <Trash2Icon className="size-3.5" />
              Delete
            </Button>
          </div>
        </div>

        <ScheduleCalendar curriculumId={curriculumId} hideCurriculumLabel />
      </div>

      <CreateScheduleModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        lockedCurriculumId={curriculumId}
        initialValues={{
          curriculumId,
          daysOfWeek: schedule.daysOfWeek,
          minutesPerDay: schedule.minutesPerDay,
          preferredTimeSlots: schedule.preferredTimeSlots as StudyTimeSlot[],
          targetCompletionDate: format(
            new Date(schedule.targetCompletionDate),
            "yyyy-MM-dd",
          ),
        }}
      />

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes every session generated for this curriculum. Your
              check-ins and streak are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              onClick={() =>
                deleteMutation.mutate({ curriculumId })
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete schedule"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ScheduleSettingsRow({
  daysOfWeek,
  minutesPerDay,
  preferredTimeSlots,
  targetCompletionDate,
  sessionCount,
}: {
  daysOfWeek: number[];
  minutesPerDay: number;
  preferredTimeSlots: StudyTimeSlot[];
  targetCompletionDate: Date | string;
  sessionCount: number;
}) {
  const dayLabels = DAYS_OF_WEEK.filter((d) => daysOfWeek.includes(d.value)).map(
    (d) => d.short,
  );
  const slotLabels = preferredTimeSlots.map(
    (s) => STUDY_TIME_SLOT_META[s].shortLabel,
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="font-medium">{dayLabels.join(" · ")}</span>
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <ClockIcon className="size-3.5" />
        {minutesPerDay} min/day
      </span>
      <span className="text-muted-foreground">{slotLabels.join(", ")}</span>
      <span className="text-muted-foreground">
        Until {format(new Date(targetCompletionDate), "MMM d, yyyy")}
      </span>
      <span className="text-muted-foreground">{sessionCount} sessions</span>
    </div>
  );
}
