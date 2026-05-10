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
import { useTRPC } from "@/trpc/client";
import { ANNOTATION_TEXT_MAX_LENGTH } from "@/inngest/schemas";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: string;
  quote: string;
  onSaved?: (annotationId: string, noteId: string) => void;
};

/**
 * Modal that asks for annotation text after a user clicks "Annotate" on a
 * lesson highlight. Saving creates the Annotation row and updates the
 * lesson's auto-managed annotation note in one round trip.
 */
export function AnnotateDialog({
  open,
  onOpenChange,
  lessonId,
  quote,
  onSaved,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <AnnotateForm
            key={quote}
            lessonId={lessonId}
            quote={quote}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AnnotateForm({
  lessonId,
  quote,
  onClose,
  onSaved,
}: {
  lessonId: string;
  quote: string;
  onClose: () => void;
  onSaved?: (annotationId: string, noteId: string) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [annotation, setAnnotation] = useState("");

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
  const empty = trimmed.length === 0;
  const overLimit = trimmed.length > ANNOTATION_TEXT_MAX_LENGTH;
  const isPending = create.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (empty || overLimit) return;
    create.mutate({ lessonId, quote, annotation });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Annotate this passage</DialogTitle>
        <DialogDescription>
          Your note will appear when you hover over the highlighted text. All
          annotations on this lesson roll up into a single note.
        </DialogDescription>
      </DialogHeader>
      <blockquote className="rounded-lg border-l-2 border-foreground/30 bg-muted/40 px-3 py-2 text-sm italic text-muted-foreground">
        {quote}
      </blockquote>
      <div className="flex flex-col gap-2">
        <Label htmlFor="annotation-text">Your note</Label>
        <Textarea
          id="annotation-text"
          value={annotation}
          onChange={(e) => setAnnotation(e.target.value)}
          placeholder="What should you remember about this passage?"
          className="min-h-[120px]"
          autoFocus
        />
        <div className="flex items-center justify-between text-xs">
          <span
            className={overLimit ? "text-destructive" : "text-muted-foreground"}
          >
            {trimmed.length} / {ANNOTATION_TEXT_MAX_LENGTH}
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
          disabled={empty || overLimit || isPending}
          className="cursor-pointer"
        >
          {isPending ? "Saving…" : "Save annotation"}
        </Button>
      </DialogFooter>
    </form>
  );
}
