"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useTRPC } from "@/trpc/client";

const POLL_INTERVAL_MS = 2_500;
const TIMEOUT_MS = 90_000;

type Props = {
  id: string;
  title?: string;
  status: "STUB" | "GENERATING" | "READY" | "FAILED";
};

export function LessonPending({ id, title, status }: Props) {
  const router = useRouter();
  const trpc = useTRPC();
  const [timedOut, setTimedOut] = useState(false);

  // Poll the lesson status until it flips to READY (or FAILED). The user
  // navigates here right after kicking off generation, so we expect a quick
  // resolution. Realtime is also wired at the layout level, but polling is
  // a robust fallback.
  const query = useQuery(
    trpc.getLessonStatus.queryOptions(
      { id },
      {
        refetchInterval: (q) => {
          const data = q.state.data;
          if (!data) return POLL_INTERVAL_MS;
          if (data.status === "READY") return false;
          if (data.status === "FAILED") return false;
          return POLL_INTERVAL_MS;
        },
        refetchIntervalInBackground: true,
        enabled: !timedOut && status !== "READY",
      },
    ),
  );

  useEffect(() => {
    if (query.data?.status === "READY") {
      router.refresh();
    }
  }, [query.data?.status, router]);

  useEffect(() => {
    if (query.data?.status === "READY" || status === "READY") return;
    const t = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [query.data?.status, status]);

  const failed = status === "FAILED" || query.data?.status === "FAILED";
  const stub = status === "STUB" && (!query.data || query.data.status === "STUB");

  if (timedOut && query.data?.status !== "READY") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center">
        <h1 className="font-heading text-2xl font-semibold">Still generating…</h1>
        <p className="text-sm text-muted-foreground">
          This is taking longer than usual. Reload in a minute, or try
          generating again from the curriculum page.
        </p>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center">
        <h1 className="font-heading text-2xl font-semibold">Generation failed</h1>
        <p className="text-sm text-muted-foreground">
          Something went wrong while building this lesson. Head back and try
          again.
        </p>
      </div>
    );
  }

  if (stub) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center">
        <h1 className="font-heading text-2xl font-semibold">Lesson not generated yet</h1>
        <p className="text-sm text-muted-foreground">
          Open the curriculum and click &ldquo;Generate&rdquo; to build this lesson.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <Loader2Icon className="size-10 animate-spin text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">
          Generating your lesson{title ? "" : "…"}
        </h1>
        {title ? (
          <p className="font-medium">{title}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          This usually takes 10–30 seconds. We&apos;ll show it as soon as it&apos;s ready.
        </p>
      </div>
    </div>
  );
}
