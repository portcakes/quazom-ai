"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpenIcon, FolderGitIcon, ListChecksIcon } from "lucide-react";
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
import { cn } from "@quazom-ai/ui/lib/utils";
import { useTRPC } from "@/trpc/client";
import type { SandboxSourceSummary } from "@/lib/queries/sandbox";
import { SandboxSourcePicker } from "./sandbox-source-picker";

type MaterialKind = "reading" | "quiz" | "project";

const KIND_OPTIONS: {
  value: MaterialKind;
  label: string;
  description: string;
  Icon: typeof BookOpenIcon;
}[] = [
  {
    value: "reading",
    label: "Reading",
    description: "A synthesised long-form reading that cites your sources.",
    Icon: BookOpenIcon,
  },
  {
    value: "quiz",
    label: "Quiz",
    description: "A knowledge check drawn from your sources.",
    Icon: ListChecksIcon,
  },
  {
    value: "project",
    label: "Project",
    description: "A hands-on project brief grounded in your research.",
    Icon: FolderGitIcon,
  },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sandboxId: string;
  sources: SandboxSourceSummary[];
  /** Optional default source selection (e.g. from a research session). */
  defaultSourceIds?: string[];
};

export function GenerateMaterialModal({
  open,
  onOpenChange,
  sandboxId,
  sources,
  defaultSourceIds,
}: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const [kind, setKind] = useState<MaterialKind>("reading");
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        defaultSourceIds && defaultSourceIds.length > 0
          ? defaultSourceIds
          : sources.map((s) => s.id),
      ),
  );

  const generate = useMutation(
    trpc.generateSandboxMaterial.mutationOptions({
      onSuccess: () => {
        toast.success("Generating material — it'll appear here shortly");
        setTitle("");
        onOpenChange(false);
        router.refresh();
      },
      onError: (err) => toast.error(err.message ?? "Failed to generate material"),
    }),
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canSubmit = !generate.isPending && title.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Material</DialogTitle>
          <DialogDescription>
            Turn your sources into a reading, quiz, or project. It opens in the
            lesson viewer and counts toward your monthly lesson limit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            {KIND_OPTIONS.map((opt) => {
              const active = kind === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setKind(opt.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors",
                    active
                      ? "border-foreground/40 bg-accent"
                      : "border-border hover:bg-accent/50",
                  )}
                >
                  <opt.Icon className="size-5" />
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {KIND_OPTIONS.find((o) => o.value === kind)?.description}
          </p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="material-title">Title</Label>
            <Input
              id="material-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What should this material cover?"
              maxLength={200}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Sources to cite</Label>
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
            disabled={generate.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              generate.mutate({
                sandboxId,
                kind,
                title: title.trim(),
                sourceIds: Array.from(selected),
              })
            }
          >
            {generate.isPending ? "Starting…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
