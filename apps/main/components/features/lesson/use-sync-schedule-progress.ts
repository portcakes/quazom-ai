"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

// Completing a lesson now flips its study session to done and can create the
// day's check-in (see the server `onLessonCompletionChanged` helper). The
// streak badge, schedule calendar and schedule widget all read that state via
// React Query, which `router.refresh()` doesn't touch — so invalidate those
// queries explicitly after a completion to keep the UI in sync immediately.
export function useSyncScheduleProgress() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: trpc.getStreak.queryKey() });
    queryClient.invalidateQueries({
      queryKey: trpc.sessionsInRange.queryKey(),
    });
  }, [queryClient, trpc]);
}
