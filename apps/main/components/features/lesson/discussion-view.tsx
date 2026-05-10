"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRealtime } from "inngest/react";
import { toast } from "sonner";
import { CheckCircle2Icon, Loader2Icon, SendIcon } from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Textarea } from "@quazom-ai/ui/components/ui/textarea";
import { useTRPC, useTRPCClient } from "@/trpc/client";
import { userChannel } from "@/inngest/channels";
import type { LessonDetail, LessonChatMessage } from "@/lib/queries/lesson";
import { Highlightable } from "./highlightable";

type Props = {
  lesson: LessonDetail;
  userId: string;
};

const REALTIME_TOPICS = ["discussionMessageReady"] as const;
// User-facing copy for the structured 2-turn flow. Keep these in sync with
// the inngest reply function — the AI alternates "first response" → "final
// response" based on user-turn count.
const MAX_USER_TURNS = 2;

export function DiscussionView({ lesson, userId }: Props) {
  const router = useRouter();
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const discussion = lesson.discussion;
  const [draft, setDraft] = useState("");
  const [waitingForReply, setWaitingForReply] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  const send = useMutation(
    trpc.sendDiscussionMessage.mutationOptions({
      onSuccess: () => {
        setDraft("");
        setWaitingForReply(true);
        // Refresh so the user message lands; AI reply comes via realtime.
        router.refresh();
      },
      onError: (err) => toast.error(err.message ?? "Failed to send"),
    }),
  );

  // Subscribe to realtime — when the AI reply lands, refresh the page to pull
  // the new chat history.
  const { messages } = useRealtime({
    channel: userChannel(userId),
    topics: REALTIME_TOPICS,
    token: async () => {
      const token = await trpcClient.realtimeToken.query();
      return typeof token.apiBaseUrl === "string"
        ? { key: token.key, apiBaseUrl: token.apiBaseUrl }
        : token.key;
    },
  });

  const lastReplyKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const latest = messages.byTopic.discussionMessageReady;
    if (!latest || latest.kind !== "data") return;
    const key = `${latest.runId ?? ""}:${latest.createdAt?.toISOString?.() ?? ""}`;
    if (lastReplyKeyRef.current === key) return;
    const data = latest.data as { discussionId: string; lessonId: string };
    if (data.lessonId !== lesson.id) return;
    lastReplyKeyRef.current = key;
    // External system (Inngest realtime) → React: this is the documented
    // exception to the set-state-in-effect rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWaitingForReply(false);
    router.refresh();
  }, [messages.byTopic.discussionMessageReady, lesson.id, router]);

  // Autoscroll the chat to bottom on new messages.
  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [discussion?.chatHistory.length, waitingForReply]);

  if (!discussion) {
    return <p className="text-sm text-muted-foreground">No discussion available.</p>;
  }

  const userTurnsSoFar = discussion.chatHistory.filter((m) => m.role === "user").length;
  const userTurnsRemaining = Math.max(0, MAX_USER_TURNS - userTurnsSoFar);
  const isClosed = discussion.isCompleted;
  const inputDisabled = isClosed || waitingForReply || send.isPending;
  const placeholder = isClosed
    ? "This discussion is closed."
    : userTurnsSoFar === 0
      ? "Share your take on the prompt… (⌘/Ctrl + Enter to send)"
      : "Follow up with one final reply… (⌘/Ctrl + Enter to send)";

  return (
    <Highlightable
      lessonId={lesson.id}
      curriculumId={lesson.module.curriculum.id}
    >
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">Topic</h2>
          {isClosed ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2Icon className="size-3.5" />
              Complete
            </span>
          ) : (
            <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
              {userTurnsRemaining} {userTurnsRemaining === 1 ? "reply" : "replies"} left
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{discussion.summary}</p>
        {discussion.objectives.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5 pt-1">
            {[...discussion.objectives]
              .sort((a, b) => a.order - b.order)
              .map((o) => (
                <li
                  key={`${o.order}-${o.title}`}
                  className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs"
                >
                  {o.title}
                </li>
              ))}
          </ul>
        ) : null}
        {!isClosed ? (
          <p className="text-xs text-muted-foreground">
            Discussions are short by design: respond to the prompt, get a take
            from the tutor, then wrap with one follow-up.
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <div
          ref={messagesRef}
          className="flex h-[28rem] flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-card/40 p-4"
        >
          {discussion.chatHistory.length === 0 ? (
            <p className="m-auto text-sm text-muted-foreground">
              Start the conversation to get the discussion going.
            </p>
          ) : (
            discussion.chatHistory.map((m, i) => (
              <ChatBubble key={i} message={m} />
            ))
          )}
          {waitingForReply ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Thinking…
            </div>
          ) : null}
          {isClosed && !waitingForReply ? (
            <div className="mt-2 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2Icon className="size-4" />
              Discussion complete — nicely done. You can&apos;t send any more
              messages here.
            </div>
          ) : null}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isClosed) return;
            const trimmed = draft.trim();
            if (!trimmed) return;
            send.mutate({ discussionId: discussion.id, content: trimmed });
          }}
          className="flex items-end gap-2"
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (isClosed) return;
                const trimmed = draft.trim();
                if (trimmed)
                  send.mutate({ discussionId: discussion.id, content: trimmed });
              }
            }}
            placeholder={placeholder}
            className="min-h-[80px]"
            maxLength={2000}
            disabled={inputDisabled}
          />
          <Button
            type="submit"
            disabled={!draft.trim() || inputDisabled}
            className="cursor-pointer"
          >
            <SendIcon className="size-4" />
            Send
          </Button>
        </form>
      </section>
    </div>
    </Highlightable>
  );
}

function ChatBubble({ message }: { message: LessonChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
