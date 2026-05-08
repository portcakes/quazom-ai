"use client";

import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { CheckCircle2Icon, FlameIcon } from "lucide-react";
import { cn } from "@quazom-ai/ui/lib/utils";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";

/**
 * Sidebar Check-In affordance. Behaviour:
 *   - Default state: "Check In" with flame icon. Clicking POSTs to
 *     `checkIn` (idempotent — backed by the user/date unique constraint).
 *   - After today's check-in is recorded: button locks to a success state
 *     ("Checked in") with a check icon and a tooltip showing the streak.
 *   - Streak count and today's status come from `getStreak` so a refresh
 *     across tabs syncs automatically.
 */
export function CheckInButton() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: streakData, isLoading } = useQuery(trpc.getStreak.queryOptions());
  const streak = streakData?.streak ?? 0;
  const checkedInToday = streakData?.checkedInToday ?? false;

  const { mutate: checkIn, isPending } = useMutation(
    trpc.checkIn.mutationOptions({
      onSuccess: () => {
        // Invalidate the streak + any session lists so the calendar
        // immediately surfaces today as "checked in".
        queryClient.invalidateQueries({ queryKey: trpc.getStreak.queryKey() });
        queryClient.invalidateQueries({
          queryKey: trpc.sessionsInRange.queryKey(),
        });
        toast.success("Checked in for today");
      },
      onError: (error) => {
        toast.error(error.message ?? "Failed to check in");
      },
    }),
  );

  const disabled = isLoading || isPending || checkedInToday;

  return (
    <button
      type="button"
      onClick={() => {
        if (checkedInToday) return;
        checkIn();
      }}
      disabled={disabled}
      aria-pressed={checkedInToday}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:bg-sidebar-accent",
        checkedInToday
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 cursor-default"
          : "text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer",
        isPending ? "opacity-70" : "",
      )}
    >
      {checkedInToday ? (
        <CheckCircle2Icon className="size-4 shrink-0" />
      ) : (
        <FlameIcon
          className={cn("size-4 shrink-0", streak > 0 ? "text-amber-500" : "")}
        />
      )}
      <span className="flex-1">{checkedInToday ? "Checked in" : "Check in"}</span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {streak > 0 ? `${streak}d` : ""}
      </span>
    </button>
  );
}
