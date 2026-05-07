"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "inngest/react";
import { toast } from "sonner";
import { userChannel } from "@/inngest/channels";
import { useTRPCClient } from "@/trpc/client";
import type { CourseSummary } from "@/lib/queries/courses";

export type PendingCourse = {
  tempId: string;
  subject: string;
};

type CourseListContextValue = {
  courses: CourseSummary[];
  pending: PendingCourse[];
  addPending: (entry: PendingCourse) => void;
  removePending: (tempId: string) => void;
};

const CourseListContext = createContext<CourseListContextValue | null>(null);

const REALTIME_TOPICS = ["curriculumReady"] as const;

type Props = {
  userId: string;
  initialCourses: CourseSummary[];
  children: React.ReactNode;
};

export function CourseListProvider({ userId, initialCourses, children }: Props) {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [pending, setPending] = useState<PendingCourse[]>([]);

  const channel = useMemo(() => userChannel(userId), [userId]);

  // Stable factory: only changes when the tRPC client identity changes,
  // which is once per provider mount.
  const tokenFactory = useCallback(async () => {
    return await trpcClient.realtimeToken.query();
  }, [trpcClient]);

  const { messages } = useRealtime({
    channel,
    topics: REALTIME_TOPICS,
    token: tokenFactory,
  });

  const lastHandledRef = useRef<string | null>(null);

  useEffect(() => {
    const latest = messages.byTopic.curriculumReady;
    if (!latest || latest.kind !== "data") return;

    const messageKey = `${latest.runId ?? ""}:${latest.createdAt?.toISOString?.() ?? ""}`;
    if (lastHandledRef.current === messageKey) return;
    lastHandledRef.current = messageKey;

    const data = latest.data as { id: string; title: string };
    setPending((current) => current.filter((entry) => entry.tempId !== data.id));
    toast.success(`"${data.title}" is ready`);
    // Re-fetches the (server) sidebar courses list and any open curriculum page
    // that's currently pending data — that's how the loading state ends.
    router.refresh();
  }, [messages.byTopic.curriculumReady, router]);

  const addPending = useCallback((entry: PendingCourse) => {
    setPending((current) => [...current, entry]);
  }, []);

  const removePending = useCallback((tempId: string) => {
    setPending((current) => current.filter((entry) => entry.tempId !== tempId));
  }, []);

  const value = useMemo<CourseListContextValue>(
    () => ({ courses: initialCourses, pending, addPending, removePending }),
    [initialCourses, pending, addPending, removePending],
  );

  return <CourseListContext.Provider value={value}>{children}</CourseListContext.Provider>;
}

export function useCourseList() {
  const ctx = useContext(CourseListContext);
  if (!ctx) {
    throw new Error("useCourseList must be used inside <CourseListProvider>");
  }
  return ctx;
}
