"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useRealtime } from "inngest/react";
import { toast } from "sonner";
import { userChannel } from "@/inngest/channels";
import { useTRPC } from "@/trpc/client";
import type { CourseSummary } from "@/lib/queries/courses";

export type PendingCourse = {
  tempId: string;
  subject: string;
};

type CourseListContextValue = {
  courses: CourseSummary[];
  pending: PendingCourse[];
  addPending: (entry: PendingCourse) => void;
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
  const trpc = useTRPC();
  const [pending, setPending] = useState<PendingCourse[]>([]);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const channel = useMemo(() => userChannel(userId), [userId]);

  const tokenQuery = useQuery(
    trpc.realtimeToken.queryOptions(undefined, {
      // Inngest tokens are short-lived; refetch generously rather than aggressively.
      staleTime: 5 * 60 * 1000,
    }),
  );

  const tokenFactory = useCallback(async () => {
    const result = await tokenQuery.refetch();
    if (!result.data) throw new Error("Failed to mint realtime token");
    return result.data;
  }, [tokenQuery]);

  const { messages } = useRealtime({
    channel,
    topics: REALTIME_TOPICS,
    token: tokenFactory,
    enabled: !!tokenQuery.data,
  });

  const lastHandledRef = useRef<string | null>(null);

  useEffect(() => {
    const latest = messages.byTopic.curriculumReady;
    if (!latest || latest.kind !== "data") return;

    const messageKey = `${latest.runId ?? ""}:${latest.createdAt?.toISOString?.() ?? ""}`;
    if (lastHandledRef.current === messageKey) return;
    lastHandledRef.current = messageKey;

    const data = latest.data as { id: string; title: string };
    setPending((current) => current.slice(1));
    toast.success(`"${data.title}" is ready`);
    router.refresh();
    router.push(`/curricula/${data.id}`);
  }, [messages.byTopic.curriculumReady, router]);

  const addPending = useCallback((entry: PendingCourse) => {
    setPending((current) => [...current, entry]);
  }, []);

  const value = useMemo<CourseListContextValue>(
    () => ({ courses: initialCourses, pending, addPending }),
    [initialCourses, pending, addPending],
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
