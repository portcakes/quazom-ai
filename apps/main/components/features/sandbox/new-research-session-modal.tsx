"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@quazom-ai/ui/components/ui/dialog";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Label } from "@quazom-ai/ui/components/ui/label";
import { useTRPC } from "@/trpc/client";
import type { SandboxSourceSummary } from "@/lib/queries/sandbox";
import { SandboxSourcePicker } from "./sandbox-source-picker";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sandboxId: string;
  sources: SandboxSourceSummary[];
  /** Called with the new session id so the parent can open the chat modal. */
  onCreated: (sessionId: string) => void;
};

export function NewResearchSessionModal({
  open,
  onOpenChange,
  sandboxId,
  sources,
  onCreated,
}: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const [title, setTitle] = useState("");
  // Default to every source selected — research usually wants all context.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(sources.map((s) => s.id)),
  );

  const create = useMutation(
    trpc.createResearchSession.mutationOptions({
      onSuccess: ({ id }) => {
        toast.success("Research session started");
        setTitle("");
        onOpenChange(false);
        router.refresh();
        onCreated(id);
      },
      onError: (err) => toast.error(err.message ?? "Failed to start session"),
    }),
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Research Session</DialogTitle>
          <DialogDescription>
            Pick the sources to ground this conversation, then chat with your AI
            research partner.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="research-session-title">Title (optional)</Label>
            <Input
              id="research-session-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Comparing primary sources"
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Sources</Label>
            <SandboxSourcePicker
              sources={sources}
              selected={selected}
              onToggle={toggle}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={create.isPending}
            onClick={() =>
              create.mutate({
                sandboxId,
                title: title.trim(),
                sourceIds: Array.from(selected),
              })
            }
          >
            {create.isPending ? "Starting…" : "Start session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
