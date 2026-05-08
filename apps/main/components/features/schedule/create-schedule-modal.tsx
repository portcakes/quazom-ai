"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, AlertTriangleIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@quazom-ai/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@quazom-ai/ui/components/ui/dialog";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Label } from "@quazom-ai/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@quazom-ai/ui/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@quazom-ai/ui/components/ui/toggle-group";
import { cn } from "@quazom-ai/ui/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useCourseList } from "@/components/features/course-list/course-list-provider";
import {
  DAYS_OF_WEEK,
  STUDY_TIME_SLOTS,
  STUDY_TIME_SLOT_META,
  type StudyTimeSlot,
} from "@/lib/schedule/time-slots";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When given, only this curriculum is selectable (curriculum-page entry). */
  lockedCurriculumId?: string;
  /** Pre-fill — used when editing an existing schedule. */
  initialValues?: Partial<FormValues> | null;
};

type FormValues = {
  curriculumId: string;
  daysOfWeek: number[];
  minutesPerDay: number;
  preferredTimeSlots: StudyTimeSlot[];
  /** YYYY-MM-DD (input[type=date] format). */
  targetCompletionDate: string;
};

const DEFAULTS: FormValues = {
  curriculumId: "",
  daysOfWeek: [1, 2, 3, 4, 5],
  minutesPerDay: 30,
  preferredTimeSlots: ["EVENING"],
  targetCompletionDate: defaultTargetDateISO(),
};

function defaultTargetDateISO(): string {
  // Default to 8 weeks out — covers a meaningful chunk of curriculum without
  // being unrealistically aggressive.
  const d = new Date();
  d.setDate(d.getDate() + 56);
  return format(d, "yyyy-MM-dd");
}

export function CreateScheduleModal({
  open,
  onOpenChange,
  lockedCurriculumId,
  initialValues,
}: Props) {
  // We render a keyed inner form so the local form state resets whenever the
  // dialog opens for a different curriculum or with new initial values —
  // avoids the React 19 set-state-in-effect lint we hit on the notes editor.
  const formKey = `${lockedCurriculumId ?? "any"}|${
    initialValues?.curriculumId ?? "new"
  }|${open ? "open" : "closed"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <ScheduleForm
          key={formKey}
          onClose={() => onOpenChange(false)}
          lockedCurriculumId={lockedCurriculumId}
          initialValues={initialValues ?? null}
        />
      </DialogContent>
    </Dialog>
  );
}

type Step = "form" | "confirm";

type PendingPreview = {
  diagnostics: {
    totalLessonMinutes: number;
    totalAvailableMinutes: number;
    scheduledDayCount: number;
    blockedSlotCount: number;
    unscheduledLessonCount: number;
    warnings: { code: string; message: string }[];
  };
  summary: {
    curriculumTitle: string;
    lessonCount: number;
    sessionCount: number;
    blockingCurricula: string[];
  };
};

function ScheduleForm({
  onClose,
  lockedCurriculumId,
  initialValues,
}: {
  onClose: () => void;
  lockedCurriculumId?: string;
  initialValues: Partial<FormValues> | null;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("form");
  const [pendingPreview, setPendingPreview] = useState<PendingPreview | null>(null);
  const [values, setValues] = useState<FormValues>(() => ({
    ...DEFAULTS,
    ...initialValues,
    ...(lockedCurriculumId ? { curriculumId: lockedCurriculumId } : {}),
  }));

  // For the curriculum picker on the global flow. We pull from the
  // already-mounted CourseListProvider context so we don't need a duplicate
  // tRPC call — the layout-level provider already has SSR'd the list.
  const courseList = useCourseList();
  const curricula = lockedCurriculumId ? [] : courseList.courses;

  const upsertMutation = useMutation(
    trpc.upsertSchedule.mutationOptions({
      onSuccess: (result) => {
        if (result.requiresConfirmation) {
          setPendingPreview({
            diagnostics: result.diagnostics,
            summary: result.summary,
          });
          setStep("confirm");
          return;
        }
        queryClient.invalidateQueries({
          queryKey: trpc.listSchedules.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.sessionsInRange.queryKey(),
        });
        toast.success("Study schedule generated");
        onClose();
      },
      onError: (error) => {
        toast.error(error.message ?? "Failed to generate schedule");
      },
    }),
  );

  const inputValid =
    values.curriculumId &&
    values.daysOfWeek.length > 0 &&
    values.preferredTimeSlots.length > 0 &&
    values.minutesPerDay >= 10 &&
    values.targetCompletionDate;

  const submit = (acceptWarnings: boolean) => {
    if (!inputValid) return;
    upsertMutation.mutate({
      curriculumId: values.curriculumId,
      daysOfWeek: values.daysOfWeek,
      minutesPerDay: values.minutesPerDay,
      preferredTimeSlots: values.preferredTimeSlots,
      // Send the date as an ISO datetime fixed to local noon to avoid
      // accidentally landing on the previous day in negative-UTC timezones.
      targetCompletionDate: localNoonISO(values.targetCompletionDate),
      acceptWarnings,
    });
  };

  if (step === "confirm" && pendingPreview) {
    return (
      <ConfirmStep
        preview={pendingPreview}
        onBack={() => setStep("form")}
        onConfirm={() => submit(true)}
        isSubmitting={upsertMutation.isPending}
      />
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create study schedule</DialogTitle>
        <DialogDescription>
          We&apos;ll pace lessons across your study days, avoiding any time
          slots already taken by your other schedules.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-5 py-2">
        {!lockedCurriculumId && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-curriculum">Curriculum</Label>
            <Select
              value={values.curriculumId}
              onValueChange={(v) => setValues((p) => ({ ...p, curriculumId: v }))}
            >
              <SelectTrigger id="schedule-curriculum">
                <SelectValue placeholder="Pick a curriculum" />
              </SelectTrigger>
              <SelectContent>
                {curricula.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
                {curricula.length === 0 && (
                  <SelectItem value="__empty" disabled>
                    No curricula yet
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label>Study days</Label>
          <ToggleGroup
            type="multiple"
            value={values.daysOfWeek.map(String)}
            onValueChange={(v) =>
              setValues((p) => ({
                ...p,
                daysOfWeek: v.map((s) => Number(s)).sort(),
              }))
            }
            className="flex flex-wrap gap-1.5"
          >
            {DAYS_OF_WEEK.map((d) => (
              <ToggleGroupItem
                key={d.value}
                value={String(d.value)}
                aria-label={d.label}
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {d.short}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-minutes">Minutes per day</Label>
            <Input
              id="schedule-minutes"
              type="number"
              min={10}
              max={480}
              step={5}
              value={values.minutesPerDay}
              onChange={(e) =>
                setValues((p) => ({
                  ...p,
                  minutesPerDay: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-target">Target completion</Label>
            <div className="relative">
              <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="schedule-target"
                type="date"
                min={format(new Date(), "yyyy-MM-dd")}
                className="pl-9"
                value={values.targetCompletionDate}
                onChange={(e) =>
                  setValues((p) => ({
                    ...p,
                    targetCompletionDate: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Preferred study times</Label>
          <ToggleGroup
            type="multiple"
            value={values.preferredTimeSlots}
            onValueChange={(v) =>
              setValues((p) => ({
                ...p,
                preferredTimeSlots: v as StudyTimeSlot[],
              }))
            }
            className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
          >
            {STUDY_TIME_SLOTS.map((slot) => (
              <ToggleGroupItem
                key={slot}
                value={slot}
                className="flex h-auto flex-col items-start gap-0.5 px-3 py-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <span className="text-sm font-semibold">
                  {STUDY_TIME_SLOT_META[slot].label}
                </span>
                <span className="text-xs opacity-80">
                  {STUDY_TIME_SLOT_META[slot].range}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => submit(false)}
          disabled={!inputValid || upsertMutation.isPending}
          className="cursor-pointer"
        >
          {upsertMutation.isPending ? "Generating…" : "Generate schedule"}
        </Button>
      </DialogFooter>
    </>
  );
}

function ConfirmStep({
  preview,
  onBack,
  onConfirm,
  isSubmitting,
}: {
  preview: PendingPreview;
  onBack: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}) {
  const { diagnostics, summary } = preview;
  const totalHours = (diagnostics.totalLessonMinutes / 60).toFixed(1);
  const availableHours = (diagnostics.totalAvailableMinutes / 60).toFixed(1);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <AlertTriangleIcon className="size-5 text-amber-500" />
          Review your schedule
        </DialogTitle>
        <DialogDescription>
          We hit a few things you should know about before generating.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4 py-2">
        {diagnostics.warnings.length > 0 && (
          <ul className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            {diagnostics.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                <span>{w.message}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Metric label="Lessons" value={String(summary.lessonCount)} />
          <Metric label="Sessions planned" value={String(summary.sessionCount)} />
          <Metric label="Estimated study time" value={`${totalHours} hr`} />
          <Metric label="Available before target" value={`${availableHours} hr`} />
          {diagnostics.blockedSlotCount > 0 && (
            <Metric
              label="Slots already booked"
              value={String(diagnostics.blockedSlotCount)}
              hint={
                summary.blockingCurricula.length > 0
                  ? `By: ${summary.blockingCurricula.join(", ")}`
                  : undefined
              }
            />
          )}
          {diagnostics.unscheduledLessonCount > 0 && (
            <Metric
              label="Won't fit"
              value={String(diagnostics.unscheduledLessonCount)}
              tone="warn"
            />
          )}
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="cursor-pointer"
        >
          Adjust
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          className="cursor-pointer"
        >
          {isSubmitting ? "Generating…" : "Generate anyway"}
        </Button>
      </DialogFooter>
    </>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border p-3",
        tone === "warn" ? "border-amber-500/40 bg-amber-500/5" : "bg-card/40",
      )}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-1">
        {tone === "warn" ? null : <CheckIcon className="size-3.5 text-emerald-500" />}
        <span className="text-base font-semibold tabular-nums">{value}</span>
      </div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Convert a YYYY-MM-DD form value into a noon-local ISO string. */
function localNoonISO(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  if (!y || !m || !d) return new Date().toISOString();
  const date = new Date(y, m - 1, d, 12, 0, 0);
  return date.toISOString();
}
