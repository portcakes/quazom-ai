"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2Icon, AlertTriangleIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { toast } from "sonner";
import { useCourseList } from "../course-list/course-list-provider";
import { useTRPC } from "@/trpc/client";

const POLL_INTERVAL_MS = 2_000;
const TIMEOUT_MS = 60_000;

type Props = {
  id: string;
  // When the page already has the curriculum row (pre-created in PENDING),
  // pass the initial kind so the loading copy reflects "Continuity" vs
  // "Single". Optional so the legacy "row absent" code path still works.
  initialKind?: "SINGLE" | "CONTINUITY";
};

export function CurriculumPending({ id, initialKind }: Props) {
  const router = useRouter();
  const trpc = useTRPC();
  const { removePending } = useCourseList();
  const [timedOut, setTimedOut] = useState(false);

  // Poll until the row reports READY (or FAILED). When the row was
  // pre-created in PENDING it already exists, so the legacy "stop polling
  // once data is non-null" heuristic doesn't apply — we keep polling until
  // status is terminal.
  const query = useQuery(
    trpc.getCurriculum.queryOptions(
      { id },
      {
        refetchInterval: (q) => {
          const data = q.state.data;
          if (!data) return POLL_INTERVAL_MS;
          if (data.status === "READY" || data.status === "FAILED") return false;
          return POLL_INTERVAL_MS;
        },
        refetchIntervalInBackground: true,
        enabled: !timedOut,
      },
    ),
  );

  // Dedupe key so we only fire `router.refresh()` once per status change to
  // READY. Cleared as soon as status drops back below READY (e.g. on retry)
  // so the next READY transition re-fires the refresh.
  const lastReadyRef = useRef<string | null>(null);
  useEffect(() => {
    const status = query.data?.status;
    if (status !== "READY") {
      lastReadyRef.current = null;
      return;
    }
    if (lastReadyRef.current === id) return;
    lastReadyRef.current = id;
    removePending(id);
    router.refresh();
  }, [query.data, id, router, removePending]);

  useEffect(() => {
    if (query.data && query.data.status !== "PENDING") return;
    const t = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [query.data]);

  const handleRetrySuccess = useCallback(() => {
    toast.info("Restarting curriculum generation");
    // Reset the timeout gate so the user can wait through another
    // generation cycle. The READY-dedupe ref auto-clears as soon as the
    // status drops back below READY (handled in the effect above), so we
    // don't need to touch it here.
    setTimedOut(false);
    router.refresh();
  }, [router]);
  const retry = useMutation(
    trpc.retryCurriculum.mutationOptions({
      onSuccess: handleRetrySuccess,
      onError: (err) => toast.error(err.message ?? "Couldn't retry"),
    }),
  );

  const kind = query.data?.kind ?? initialKind ?? "SINGLE";
  const status = query.data?.status;

  if (status === "FAILED") {
    const message =
      query.data?.statusMessage ?? "Curriculum generation failed.";
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
        <AlertTriangleIcon className="size-10 text-destructive" />
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold">
            Curriculum generation failed
          </h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Button
          type="button"
          onClick={() => retry.mutate({ id })}
          disabled={retry.isPending}
        >
          <RotateCcwIcon className="mr-2 size-4" />
          {retry.isPending ? "Retrying…" : "Retry"}
        </Button>
      </div>
    );
  }

  if (timedOut && (!query.data || query.data.status === "PENDING")) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center">
        <h1 className="font-heading text-2xl font-semibold">
          Still generating…
        </h1>
        <p className="text-sm text-muted-foreground">
          This is taking longer than usual. Refresh the page in a minute, or
          retry from the curriculum list if it gets stuck.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <Loader2Icon className="size-10 animate-spin text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">
          {kind === "CONTINUITY"
            ? "Generating your Continuity Curriculum"
            : "Generating your curriculum"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {kind === "CONTINUITY"
            ? "Reading your sources and assembling modules. This can take up to a minute."
            : "This usually takes a few seconds. We'll show it as soon as it's ready."}
        </p>
      </div>
    </div>
  );
}
