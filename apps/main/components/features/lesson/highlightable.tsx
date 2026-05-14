"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@quazom-ai/ui/lib/utils";
import {
  HighlightToolbar,
  useTextSelection,
} from "@/components/features/notes/highlight-toolbar";
import { NoteBottomSheet } from "@/components/features/notes/note-bottom-sheet";
import { AnnotateDialog } from "@/components/features/notes/annotate-dialog";
import { useTRPC } from "@/trpc/client";
import type { AnnotationColor } from "@/inngest/schemas";

type LessonTarget = {
  kind: "lesson";
  lessonId: string;
  curriculumId: string;
};

type ResourceTarget = {
  kind: "resource";
  resourceId: string;
};

type Props = {
  /** Polymorphic target — lesson or resource. Determines where new notes
   *  and annotations are pinned. */
  target?: LessonTarget | ResourceTarget;
  /** Backwards-compatible shortcut for lesson targets. */
  lessonId?: string;
  curriculumId?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Wraps a region of content (a lesson view, a resource viewer body, etc.).
 * Captures any text selection inside the region and shows a floating
 * toolbar with three actions:
 *
 *   1. "Quote" — opens the bottom-sheet note composer pre-filled with the
 *      highlighted text as a markdown blockquote.
 *   2. Colour swatches — instantly save a colour-only highlight (no
 *      commentary) in the picked colour. Optimistic UX: dismiss the
 *      toolbar, save in the background, refresh annotations on success.
 *   3. "Add note" — opens the annotate dialog so the user can pair the
 *      highlight with commentary (and tweak the colour).
 *
 * The wrapper itself is a transparent <div> — it doesn't impose layout, so
 * existing surfaces can drop it around their root content with no visual
 * change.
 */
export function Highlightable({
  target: targetProp,
  lessonId,
  curriculumId,
  className,
  children,
}: Props) {
  const target: LessonTarget | ResourceTarget | null =
    targetProp ??
    (lessonId && curriculumId
      ? { kind: "lesson", lessonId, curriculumId }
      : null);
  if (!target) {
    throw new Error(
      "Highlightable requires either `target` or both `lessonId` and `curriculumId`",
    );
  }

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const ref = useRef<HTMLDivElement>(null);
  const { selection, clearSelection } = useTextSelection(ref);

  const [pendingQuote, setPendingQuote] = useState<string | null>(null);
  const [annotateOpen, setAnnotateOpen] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);

  const handleQuote = useCallback(() => {
    if (!selection) return;
    setPendingQuote(selection.text);
    setBottomSheetOpen(true);
    clearSelection();
    window.getSelection()?.removeAllRanges();
  }, [selection, clearSelection]);

  const handleAnnotate = useCallback(() => {
    if (!selection) return;
    setPendingQuote(selection.text);
    setAnnotateOpen(true);
    clearSelection();
    window.getSelection()?.removeAllRanges();
  }, [selection, clearSelection]);

  const createAnnotation = useMutation(
    trpc.createAnnotation.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.listAnnotations.pathKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.listNotes.pathKey(),
        });
      },
      onError: (err) =>
        toast.error(err.message ?? "Failed to save highlight"),
    }),
  );

  const handleHighlight = useCallback(
    (color: AnnotationColor) => {
      if (!selection) return;
      const quote = selection.text;
      clearSelection();
      window.getSelection()?.removeAllRanges();
      createAnnotation.mutate({
        ...(target.kind === "lesson"
          ? { lessonId: target.lessonId }
          : { resourceId: target.resourceId }),
        quote,
        annotation: null,
        color,
      });
    },
    [selection, target, clearSelection, createAnnotation],
  );

  const initialContent = pendingQuote
    ? `${pendingQuote
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}\n\n`
    : "";

  const lessonScope =
    target.kind === "lesson"
      ? {
          lessonId: target.lessonId,
          curriculumId: target.curriculumId,
        }
      : { lessonId: undefined, curriculumId: undefined };
  const resourceId = target.kind === "resource" ? target.resourceId : undefined;

  return (
    <div ref={ref} className={cn("relative", className)}>
      {children}

      <HighlightToolbar
        position={selection?.position ?? null}
        selectionText={selection?.text ?? ""}
        onQuote={handleQuote}
        onHighlight={handleHighlight}
        onAnnotate={handleAnnotate}
        onDismiss={clearSelection}
      />

      <NoteBottomSheet
        open={bottomSheetOpen}
        onOpenChange={(o) => {
          setBottomSheetOpen(o);
          if (!o) setPendingQuote(null);
        }}
        lessonId={lessonScope.lessonId}
        curriculumId={lessonScope.curriculumId}
        resourceId={resourceId}
        initialContent={initialContent}
      />

      {pendingQuote ? (
        <AnnotateDialog
          open={annotateOpen}
          onOpenChange={(o) => {
            setAnnotateOpen(o);
            if (!o) setPendingQuote(null);
          }}
          target={
            target.kind === "lesson"
              ? { kind: "lesson", lessonId: target.lessonId }
              : { kind: "resource", resourceId: target.resourceId }
          }
          quote={pendingQuote}
        />
      ) : null}
    </div>
  );
}
