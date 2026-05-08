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
  /**
   * Total number of curricula owned by the user, including hidden ones.
   * Used to decide whether to show the "See all Curricula" sidebar link.
   */
  totalCount: number;
  addPending: (entry: PendingCourse) => void;
  removePending: (tempId: string) => void;
};

const CourseListContext = createContext<CourseListContextValue | null>(null);

// Topics this provider listens for. Lesson-related topics are included so the
// nav-level subscription handles refreshes for any open lesson page (no
// per-page subscription needed for the simple "ready" → refresh case).
const REALTIME_TOPICS = [
  "curriculumReady",
  "lessonReady",
  "lessonFailed",
  "feedbackReady",
] as const;

type Props = {
  userId: string;
  initialCourses: CourseSummary[];
  initialTotalCount: number;
  children: React.ReactNode;
};

export function CourseListProvider({
  userId,
  initialCourses,
  initialTotalCount,
  children,
}: Props) {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [pending, setPending] = useState<PendingCourse[]>([]);

  const channel = useMemo(() => userChannel(userId), [userId]);

  // Stable factory: only changes when the tRPC client identity changes,
  // which is once per provider mount.
  const tokenFactory = useCallback(async () => {
    const token = await trpcClient.realtimeToken.query();
    if (!token.key) {
      throw new Error("Failed to mint Inngest realtime subscription");
    }
    // Minted keys are scoped to the same API host the server used (`apiBaseUrl`).
    // Returning only `key` makes the browser default to api.inngest.com and breaks
    // dev (localhost:8288) realtime — see TokenSubscription#getWsUrl.
    return typeof token.apiBaseUrl === "string"
      ? { key: token.key, apiBaseUrl: token.apiBaseUrl }
      : token.key;
  }, [trpcClient]);

  const { messages } = useRealtime({
    channel,
    topics: REALTIME_TOPICS,
    token: tokenFactory,
  });

  const lastHandledRef = useRef<Record<string, string | null>>({});

  // Curriculum ready — clear pending state and toast.
  useEffect(() => {
    const latest = messages.byTopic.curriculumReady;
    if (!latest || latest.kind !== "data") return;
    const messageKey = `${latest.runId ?? ""}:${latest.createdAt?.toISOString?.() ?? ""}`;
    if (lastHandledRef.current.curriculumReady === messageKey) return;
    lastHandledRef.current.curriculumReady = messageKey;

    const data = latest.data as { id: string; title: string };
    setPending((current) => current.filter((entry) => entry.tempId !== data.id));
    toast.success(`"${data.title}" is ready`);
    router.refresh();
  }, [messages.byTopic.curriculumReady, router]);

  // Lesson ready — refresh whichever page the user is on (lesson page picks
  // up the new content, curriculum page picks up the updated status).
  useEffect(() => {
    const latest = messages.byTopic.lessonReady;
    if (!latest || latest.kind !== "data") return;
    const messageKey = `${latest.runId ?? ""}:${latest.createdAt?.toISOString?.() ?? ""}`;
    if (lastHandledRef.current.lessonReady === messageKey) return;
    lastHandledRef.current.lessonReady = messageKey;

    const data = latest.data as { id: string; title: string };
    toast.success(`"${data.title}" lesson is ready`);
    router.refresh();
  }, [messages.byTopic.lessonReady, router]);

  // Lesson failed — surface the error and refresh.
  useEffect(() => {
    const latest = messages.byTopic.lessonFailed;
    if (!latest || latest.kind !== "data") return;
    const messageKey = `${latest.runId ?? ""}:${latest.createdAt?.toISOString?.() ?? ""}`;
    if (lastHandledRef.current.lessonFailed === messageKey) return;
    lastHandledRef.current.lessonFailed = messageKey;

    const data = latest.data as { id: string; message: string };
    toast.error(`Lesson generation failed: ${data.message}`);
    router.refresh();
  }, [messages.byTopic.lessonFailed, router]);

  // Feedback ready — refresh so the score card pulls the new feedback JSON.
  useEffect(() => {
    const latest = messages.byTopic.feedbackReady;
    if (!latest || latest.kind !== "data") return;
    const messageKey = `${latest.runId ?? ""}:${latest.createdAt?.toISOString?.() ?? ""}`;
    if (lastHandledRef.current.feedbackReady === messageKey) return;
    lastHandledRef.current.feedbackReady = messageKey;

    router.refresh();
  }, [messages.byTopic.feedbackReady, router]);

  const addPending = useCallback((entry: PendingCourse) => {
    setPending((current) => [...current, entry]);
  }, []);

  const removePending = useCallback((tempId: string) => {
    setPending((current) => current.filter((entry) => entry.tempId !== tempId));
  }, []);

  const value = useMemo<CourseListContextValue>(
    () => ({
      courses: initialCourses,
      pending,
      totalCount: initialTotalCount,
      addPending,
      removePending,
    }),
    [initialCourses, initialTotalCount, pending, addPending, removePending],
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
