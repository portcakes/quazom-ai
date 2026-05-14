"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@quazom-ai/ui/components/ui/label";
import { Textarea } from "@quazom-ai/ui/components/ui/textarea";
import { cn } from "@quazom-ai/ui/lib/utils";
import { useTRPC } from "@/trpc/client";
import {
  ANNOTATION_TEXT_MAX_LENGTH,
  type AnnotationColor,
} from "@/inngest/schemas";
import {
  ANNOTATION_COLOR_ORDER,
  ANNOTATION_LABEL,
  ANNOTATION_SWATCH,
} from "@/lib/annotation-colors";

type Target =
  | { kind: "lesson"; lessonId: string }
  | { kind: "resource"; resourceId: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The surface this annotation anchors to. Mutually exclusive. */
  target: Target;
  quote: string;
  /** Initial highlight colour. Defaults to YELLOW. */
  initialColor?: AnnotationColor;
  onSaved?: (annotationId: string, noteId: string) => void;
};

/**
 * Modal that surfaces a colour picker and an optional commentary textarea
 * after the user clicks "Add note" on a highlight selection. Saving creates
 * the Annotation row (with the picked colour + commentary) and updates
 * that surface's auto-managed annotation note in one round trip.
 *
 * Commentary is optional now — saving with an empty textarea creates a
 * colour-only highlight (no popover surfaces over the passage).
 */
export function AnnotateDialog({
  open,
  onOpenChange,
  target,
  quote,
  initialColor = "YELLOW",
  onSaved,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <AnnotateForm
            key={`${describeTarget(target)}:${quote}`}
            target={target}
            quote={quote}
            initialColor={initialColor}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AnnotateForm({
  target,
  quote,
  initialColor,
  onClose,
  onSaved,
}: {
  target: Target;
  quote: string;
  initialColor: AnnotationColor;
  onClose: () => void;
  onSaved?: (annotationId: string, noteId: string) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [annotation, setAnnotation] = useState("");
  const [color, setColor] = useState<AnnotationColor>(initialColor);

  const create = useMutation(
    trpc.createAnnotation.mutationOptions({
      onSuccess: (data) => {
        toast.success("Annotation saved");
        void queryClient.invalidateQueries({
          queryKey: trpc.listAnnotations.pathKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.listNotes.pathKey(),
        });
        onSaved?.(data.annotationId, data.noteId);
        onClose();
      },
      onError: (err) =>
        toast.error(err.message ?? "Failed to save annotation"),
    }),
  );

  const trimmed = annotation.trim();
  const overLimit = trimmed.length > ANNOTATION_TEXT_MAX_LENGTH;
  const isPending = create.isPending;
  const hasCommentary = trimmed.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (overLimit) return;
    create.mutate({
      ...(target.kind === "lesson"
        ? { lessonId: target.lessonId }
        : { resourceId: target.resourceId }),
      quote,
      annotation: hasCommentary ? annotation : null,
      color,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Save a highlight</DialogTitle>
        <DialogDescription>
          Pick a colour and (optionally) jot a thought. Highlights without
          commentary just paint the passage; with commentary, they surface
          a hover card on the marked text.
        </DialogDescription>
      </DialogHeader>
      <blockquote className="rounded-lg border-l-2 border-foreground/30 bg-muted/40 px-3 py-2 text-sm italic text-muted-foreground">
        {quote}
      </blockquote>
      <div className="flex flex-col gap-2">
        <Label>Highlight colour</Label>
        <div className="flex flex-wrap items-center gap-2">
          {ANNOTATION_COLOR_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Pick ${ANNOTATION_LABEL[c]}`}
              aria-pressed={color === c}
              className={cn(
                "flex size-7 items-center justify-center rounded-full transition-transform hover:scale-105",
                ANNOTATION_SWATCH[c],
                color === c
                  ? "ring-2 ring-offset-2 ring-offset-background ring-foreground"
                  : "ring-1 ring-foreground/10",
              )}
            />
          ))}
          <span className="ml-1 text-xs text-muted-foreground">
            {ANNOTATION_LABEL[color]}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="annotation-text">Note (optional)</Label>
        <Textarea
          id="annotation-text"
          value={annotation}
          onChange={(e) => setAnnotation(e.target.value)}
          placeholder="Optional — what should you remember about this passage?"
          className="min-h-[120px]"
        />
        <div className="flex items-center justify-between text-xs">
          <span
            className={overLimit ? "text-destructive" : "text-muted-foreground"}
          >
            {trimmed.length} / {ANNOTATION_TEXT_MAX_LENGTH}
          </span>
          <span className="text-muted-foreground">
            {hasCommentary
              ? "Saves a hover-card annotation."
              : "Saves a colour-only highlight."}
          </span>
        </div>
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={overLimit || isPending}
          className="cursor-pointer"
        >
          {isPending
            ? "Saving…"
            : hasCommentary
              ? "Save annotation"
              : "Save highlight"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function describeTarget(target: Target): string {
  return target.kind === "lesson"
    ? `lesson:${target.lessonId}`
    : `resource:${target.resourceId}`;
}
