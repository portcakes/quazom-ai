"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useCourseList } from "../course-list/course-list-provider";
import { useTRPC } from "@/trpc/client";

const POLL_INTERVAL_MS = 2_000;
const TIMEOUT_MS = 60_000;

type Props = {
  id: string;
};

export function CurriculumPending({ id }: Props) {
  const router = useRouter();
  const trpc = useTRPC();
  const { removePending } = useCourseList();
  const [timedOut, setTimedOut] = useState(false);

  const query = useQuery(
    trpc.getCurriculum.queryOptions(
      { id },
      {
        refetchInterval: (q) => (q.state.data ? false : POLL_INTERVAL_MS),
        refetchIntervalInBackground: true,
        enabled: !timedOut,
      },
    ),
  );

  useEffect(() => {
    if (!query.data) return;
    removePending(id);
    // Re-fetch the server page so it picks up the now-existing row and
    // renders the real curriculum view.
    router.refresh();
  }, [query.data, id, router, removePending]);

  useEffect(() => {
    if (query.data) return;
    const t = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [query.data]);

  if (timedOut && !query.data) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center">
        <h1 className="font-heading text-2xl font-semibold">Curriculum not found</h1>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t locate this curriculum. It may have been deleted, or you may not have access.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <Loader2Icon className="size-10 animate-spin text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Generating your curriculum</h1>
        <p className="text-sm text-muted-foreground">
          This usually takes a few seconds. We&apos;ll show it as soon as it&apos;s ready.
        </p>
      </div>
    </div>
  );
}
