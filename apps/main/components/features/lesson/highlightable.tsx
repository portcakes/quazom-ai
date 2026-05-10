"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@quazom-ai/ui/lib/utils";
import {
  HighlightToolbar,
  useTextSelection,
} from "@/components/features/notes/highlight-toolbar";
import { NoteBottomSheet } from "@/components/features/notes/note-bottom-sheet";
import { AnnotateDialog } from "@/components/features/notes/annotate-dialog";

type Props = {
  lessonId: string;
  curriculumId: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Wraps a region of lesson content. Captures any text selection inside the
 * region and shows a small floating toolbar with two actions:
 *   1. "Insert as quote" — opens the lesson note bottom sheet pre-filled
 *      with the highlighted text as a markdown blockquote.
 *   2. "Annotate" — opens a dialog to attach commentary; the saved
 *      annotation appears in a hover card on the highlighted passage and
 *      gets rolled into the lesson's auto-managed annotations note.
 *
 * The wrapper itself is a transparent <div> — it doesn't impose layout, so
 * existing lesson views can drop it around their root content with no
 * visual change.
 */
export function Highlightable({
  lessonId,
  curriculumId,
  className,
  children,
}: Props) {
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

  const initialContent = pendingQuote
    ? `${pendingQuote
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}\n\n`
    : "";

  return (
    <div ref={ref} className={cn("relative", className)}>
      {children}

      <HighlightToolbar
        position={selection?.position ?? null}
        selectionText={selection?.text ?? ""}
        onQuote={handleQuote}
        onAnnotate={handleAnnotate}
        onDismiss={clearSelection}
      />

      <NoteBottomSheet
        open={bottomSheetOpen}
        onOpenChange={(o) => {
          setBottomSheetOpen(o);
          if (!o) setPendingQuote(null);
        }}
        lessonId={lessonId}
        curriculumId={curriculumId}
        initialContent={initialContent}
      />

      {pendingQuote ? (
        <AnnotateDialog
          open={annotateOpen}
          onOpenChange={(o) => {
            setAnnotateOpen(o);
            if (!o) setPendingQuote(null);
          }}
          lessonId={lessonId}
          quote={pendingQuote}
        />
      ) : null}
    </div>
  );
}
