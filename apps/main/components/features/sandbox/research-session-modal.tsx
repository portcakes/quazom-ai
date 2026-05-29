"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRealtime } from "inngest/react";
import { toast } from "sonner";
import { Loader2Icon, SendIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@quazom-ai/ui/components/ui/dialog";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Textarea } from "@quazom-ai/ui/components/ui/textarea";
import { useTRPC, useTRPCClient } from "@/trpc/client";
import { userChannel } from "@/inngest/channels";

const REALTIME_TOPICS = [
  "researchMessageReady",
  "researchMessageFailed",
] as const;

type ChatMessage = { role: string; content: string; createdAt: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  userId: string;
};

export function ResearchSessionModal({
  open,
  onOpenChange,
  sessionId,
  userId,
}: Props) {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [waitingForReply, setWaitingForReply] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  const sessionQuery = useQuery(
    trpc.getResearchSession.queryOptions(
      { id: sessionId ?? "" },
      { enabled: open && Boolean(sessionId) },
    ),
  );
  const session = sessionQuery.data;
  const chatHistory: ChatMessage[] = session?.chatHistory ?? [];

  const send = useMutation(
    trpc.sendResearchMessage.mutationOptions({
      onSuccess: () => {
        setDraft("");
        setWaitingForReply(true);
        if (sessionId) {
          queryClient.invalidateQueries({
            queryKey: trpc.getResearchSession.queryKey({ id: sessionId }),
          });
        }
      },
      onError: (err) => toast.error(err.message ?? "Failed to send message"),
    }),
  );

  const channel = useMemo(() => userChannel(userId), [userId]);
  const tokenFactory = useCallback(async () => {
    const token = await trpcClient.realtimeToken.query();
    return typeof token.apiBaseUrl === "string"
      ? { key: token.key, apiBaseUrl: token.apiBaseUrl }
      : token.key;
  }, [trpcClient]);

  const { messages } = useRealtime({
    channel,
    topics: REALTIME_TOPICS,
    token: tokenFactory,
  });

  const lastReadyRef = useRef<string | null>(null);
  useEffect(() => {
    const latest = messages.byTopic.researchMessageReady;
    if (!latest || latest.kind !== "data") return;
    const key = `${latest.runId ?? ""}:${latest.createdAt?.toISOString?.() ?? ""}`;
    if (lastReadyRef.current === key) return;
    const data = latest.data as { sessionId: string; sandboxId: string };
    if (!sessionId || data.sessionId !== sessionId) return;
    lastReadyRef.current = key;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWaitingForReply(false);
    queryClient.invalidateQueries({
      queryKey: trpc.getResearchSession.queryKey({ id: sessionId }),
    });
    // Refresh server data so the session card's message count stays accurate.
    router.refresh();
  }, [messages.byTopic.researchMessageReady, sessionId, queryClient, trpc, router]);

  const lastFailedRef = useRef<string | null>(null);
  useEffect(() => {
    const latest = messages.byTopic.researchMessageFailed;
    if (!latest || latest.kind !== "data") return;
    const key = `${latest.runId ?? ""}:${latest.createdAt?.toISOString?.() ?? ""}`;
    if (lastFailedRef.current === key) return;
    const data = latest.data as { sessionId: string; message: string };
    if (!sessionId || data.sessionId !== sessionId) return;
    lastFailedRef.current = key;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWaitingForReply(false);
    toast.error(`Research reply failed: ${data.message}`);
  }, [messages.byTopic.researchMessageFailed, sessionId]);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [chatHistory.length, waitingForReply]);

  const submit = () => {
    if (!sessionId) return;
    const trimmed = draft.trim();
    if (!trimmed || waitingForReply || send.isPending) return;
    send.mutate({ sessionId, content: trimmed });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{session?.title ?? "Research Session"}</DialogTitle>
          <DialogDescription>
            Multi-turn research chat grounded in your selected sources. Ask
            follow-ups freely — there&apos;s no turn limit.
          </DialogDescription>
        </DialogHeader>

        {session && session.sources.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {session.sources.map((s) => (
              <Badge key={s.id} variant="secondary" className="text-[10px]">
                {s.label}
              </Badge>
            ))}
          </div>
        ) : null}

        <div
          ref={messagesRef}
          className="flex min-h-[20rem] flex-1 flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-card/40 p-4"
        >
          {sessionQuery.isLoading ? (
            <div className="m-auto flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" /> Loading…
            </div>
          ) : chatHistory.length === 0 ? (
            <p className="m-auto text-sm text-muted-foreground">
              Ask your first research question to get started.
            </p>
          ) : (
            chatHistory.map((m, i) => <ChatBubble key={i} message={m} />)
          )}
          {waitingForReply ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" /> Researching…
            </div>
          ) : null}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-end gap-2"
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask a research question… (⌘/Ctrl + Enter to send)"
            className="min-h-[80px]"
            maxLength={4000}
            disabled={waitingForReply || send.isPending}
          />
          <Button
            type="submit"
            disabled={!draft.trim() || waitingForReply || send.isPending}
            className="cursor-pointer"
          >
            <SendIcon className="size-4" />
            Send
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
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
