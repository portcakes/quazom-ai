"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog as DialogPrimitive } from "radix-ui";
import { SparklesIcon, TagIcon, XIcon } from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Label } from "@quazom-ai/ui/components/ui/label";
import { cn } from "@quazom-ai/ui/lib/utils";
import { useTRPC } from "@/trpc/client";
import {
  NOTE_DESCRIPTION_MAX_LENGTH,
  NOTE_MAX_LENGTH,
} from "@/inngest/schemas";
import { MarkdownEditor } from "./markdown-editor";
import { NoteTagsInput } from "./note-tags-input";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-attach the new note to this lesson. */
  lessonId?: string | null;
  /** Pre-attach the new note to this curriculum. */
  curriculumId?: string | null;
  /** Pre-attach the new note to this resource. */
  resourceId?: string | null;
  /** Optional initial content (e.g. a pre-filled markdown quote block). */
  initialContent?: string;
  /** Optional initial title. */
  initialTitle?: string;
  /** Fired when the note is created. */
  onCreated?: (id: string) => void;
};

// Default and clamp range for the editor textarea. The user can drag the
// sheet handle to shrink the editor down to a quarter of its starting
// height so they can read the lesson behind it; everything else (toolbar,
// title input, description input, footer) stays the same size.
const TEXTAREA_DEFAULT_PX = 220;
const TEXTAREA_MIN_RATIO = 0.25;
// Approximate vertical space the non-editor chrome takes (handle + header
// + title input + description input + counter + footer + padding). Used
// only to pick a sensible default editor height on short viewports
// (e.g. landscape phones) so the sheet doesn't fill the screen.
const SHEET_CHROME_PX = 360;
// Cap the entire sheet at this fraction of the viewport so the lesson is
// always at least partially visible above it. `svh` keeps the cap stable
// when mobile browser chrome shows/hides.
const SHEET_MAX_VH = 85;

/**
 * Bottom-sheet note composer used inside a lesson surface. Mirrors the full
 * note page editor (markdown toolbar, title, description, summarize) so the
 * "create" and "edit" experiences feel like the same tool.
 *
 * Built on Radix Dialog with `modal={false}` so:
 *   - the lesson behind the sheet is NOT blurred and stays scrollable,
 *   - clicking outside the sheet doesn't close it,
 *   - keyboard focus can move between the sheet and the lesson.
 *
 * The grip at the top of the sheet is a drag handle: the user can pull the
 * sheet down to shrink the editor (revealing more lesson) or back up to
 * restore it. Only the editor textarea resizes — everything else is fixed.
 */
export function NoteBottomSheet({
  open,
  onOpenChange,
  lessonId,
  curriculumId,
  resourceId,
  initialContent = "",
  initialTitle = "",
  onCreated,
}: Props) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      // Non-modal: don't lock body scroll, don't trap focus, don't paint an
      // overlay over the page. The user keeps interacting with the lesson.
      modal={false}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          data-slot="note-bottom-sheet"
          aria-describedby={undefined}
          // Keep the sheet open while the user clicks/scrolls/selects in
          // the lesson behind it. They dismiss it via Cancel, Save, the X
          // button, or Escape.
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          // `max-h-[85svh]` (no width cap) keeps the lesson visible above
          // the sheet on every viewport — including landscape phones where
          // the sheet would otherwise fill the screen. The form below scrolls
          // internally when it doesn't fit.
          style={{ maxHeight: `${SHEET_MAX_VH}svh` }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-2xl border-t border-border bg-popover text-popover-foreground shadow-2xl",
            "data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-10",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-10",
            "duration-200",
          )}
        >
          {open ? (
            <NoteBottomSheetForm
              key={`${lessonId ?? "no-lesson"}:${resourceId ?? "no-resource"}:${initialContent.length}`}
              lessonId={lessonId ?? null}
              curriculumId={curriculumId ?? null}
              resourceId={resourceId ?? null}
              initialContent={initialContent}
              initialTitle={initialTitle}
              onClose={() => onOpenChange(false)}
              onCreated={onCreated}
            />
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function NoteBottomSheetForm({
  lessonId,
  curriculumId,
  resourceId,
  initialContent,
  initialTitle,
  onClose,
  onCreated,
}: {
  lessonId: string | null;
  curriculumId: string | null;
  resourceId: string | null;
  initialContent: string;
  initialTitle: string;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState("");
  const [content, setContent] = useState(initialContent);
  const [tags, setTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);

  // Editor height the user is currently dragging to. Clamped to
  // [TEXTAREA_DEFAULT_PX * MIN_RATIO, TEXTAREA_DEFAULT_PX]. Initialised
  // from the viewport so landscape phones don't open with a sheet that
  // covers the whole screen; the user can still drag to resize within the
  // standard range.
  const [editorHeight, setEditorHeight] = useState(() =>
    pickInitialEditorHeight(),
  );
  const dragRef = useRef<{
    startY: number;
    startHeight: number;
    pointerId: number;
  } | null>(null);

  const minHeight = Math.round(TEXTAREA_DEFAULT_PX * TEXTAREA_MIN_RATIO);
  const maxHeight = TEXTAREA_DEFAULT_PX;

  // Re-pick a sensible default if the viewport changes (e.g. orientation
  // flip from portrait to landscape) but only when the user hasn't been
  // dragging — once they've taken over the size we leave it alone.
  const userResizedRef = useRef(false);
  useEffect(() => {
    function onResize() {
      if (userResizedRef.current) return;
      setEditorHeight(pickInitialEditorHeight());
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onHandlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Only react to the primary mouse button / single-finger touch.
      if (event.button !== 0 && event.pointerType === "mouse") return;
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);
      dragRef.current = {
        startY: event.clientY,
        startHeight: editorHeight,
        pointerId: event.pointerId,
      };
      // Suppress text selection while dragging.
      document.body.style.userSelect = "none";
    },
    [editorHeight],
  );

  const onHandlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      // Drag down (positive delta) shrinks the editor; drag up grows it.
      const delta = event.clientY - drag.startY;
      const next = Math.max(
        minHeight,
        Math.min(maxHeight, drag.startHeight - delta),
      );
      userResizedRef.current = true;
      setEditorHeight(next);
    },
    [minHeight, maxHeight],
  );

  const onHandlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      dragRef.current = null;
      document.body.style.userSelect = "";
    },
    [],
  );

  // Restore body user-select if the component unmounts mid-drag.
  useEffect(() => {
    return () => {
      document.body.style.userSelect = "";
    };
  }, []);

  // Double-click on the handle resets to the viewport-aware default. Tiny
  // QoL shortcut so the user can snap back without dragging precisely, and
  // hands future viewport changes back to the auto-resize observer.
  const onHandleDoubleClick = useCallback(() => {
    userResizedRef.current = false;
    setEditorHeight(pickInitialEditorHeight());
  }, []);

  const create = useMutation(
    trpc.createNote.mutationOptions({
      onSuccess: (n) => {
        toast.success("Note saved");
        void queryClient.invalidateQueries({
          queryKey: trpc.listNotes.pathKey(),
        });
        onCreated?.(n.id);
        onClose();
      },
      onError: (err) => toast.error(err.message ?? "Failed to save note"),
    }),
  );

  const summarize = useMutation(
    trpc.summarizeNote.mutationOptions({
      onSuccess: (data) => {
        setTitle(data.title);
        setDescription(data.description);
        toast.success("Summary generated");
      },
      onError: (err) => toast.error(err.message ?? "Failed to summarize"),
    }),
  );

  const trimmed = content.trim();
  const overLimit = trimmed.length > NOTE_MAX_LENGTH;
  const empty = trimmed.length === 0;
  const isPending = create.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (empty || overLimit) return;
    create.mutate({
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      content,
      tags: tags.length > 0 ? tags : undefined,
      lessonId: lessonId ?? undefined,
      curriculumId: curriculumId ?? undefined,
      resourceId: resourceId ?? undefined,
    });
  };

  return (
    // Sheet is bounded by `max-h-[85svh]` from the outer Content; this
    // wrapper fills that bound so the form area below can scroll while
    // the drag handle stays pinned at the top.
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Drag handle. Acts as the grip for resizing AND as a visual cue. */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize note editor"
        // The full-width strip is the hit target so a hurried drag still
        // catches it; the visual pill sits in the middle for affordance.
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
        onDoubleClick={onHandleDoubleClick}
        className="flex h-5 w-full shrink-0 cursor-row-resize items-center justify-center select-none touch-none"
      >
        <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30 transition-colors hover:bg-muted-foreground/50" />
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-y-auto overscroll-contain px-4 sm:px-6">
        <div className="flex items-start justify-between gap-3 py-2">
          <div className="flex flex-col gap-0.5">
            <DialogPrimitive.Title className="font-heading text-lg font-semibold tracking-tight">
              New note
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              Capture a thought from this lesson. You can format it with
              markdown and edit it later from the notes page.
            </DialogPrimitive.Description>
          </div>
          <DialogPrimitive.Close asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              aria-label="Close note editor"
            >
              <XIcon className="size-4" />
            </Button>
          </DialogPrimitive.Close>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 pb-6 pt-2"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="bs-note-title">Title (optional)</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="cursor-pointer"
                disabled={empty || summarize.isPending}
                onClick={() => summarize.mutate({ content })}
              >
                <SparklesIcon className="size-4" />
                {summarize.isPending ? "Summarizing…" : "Summarize my note"}
              </Button>
            </div>
            <Input
              id="bs-note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Add a short title…"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bs-note-description">Description (optional)</Label>
            <Input
              id="bs-note-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={NOTE_DESCRIPTION_MAX_LENGTH}
              placeholder="A 1-2 sentence summary of this note…"
            />
          </div>
          <div className="flex flex-col gap-2">
            {showTags || tags.length > 0 ? (
              <>
                <Label htmlFor="bs-note-tags">Tags</Label>
                <NoteTagsInput
                  inputId="bs-note-tags"
                  value={tags}
                  onChange={setTags}
                />
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-fit cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => setShowTags(true)}
              >
                <TagIcon className="size-3.5" />
                Add tags
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bs-note-content">Note</Label>
            <MarkdownEditor
              value={content}
              onChange={setContent}
              heightPx={editorHeight}
              placeholder="Write your note. Markdown is supported."
            />
            <div className="flex items-center justify-between text-xs">
              <span
                className={
                  overLimit ? "text-destructive" : "text-muted-foreground"
                }
              >
                {trimmed.length} / {NOTE_MAX_LENGTH}
              </span>
              {overLimit ? (
                <span className="text-destructive">Note is too long.</span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
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
              {isPending ? "Saving…" : "Create note"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Pick a sensible starting height for the markdown editor based on the
 * current viewport. On tall screens (desktop / portrait phones) we use the
 * full {@link TEXTAREA_DEFAULT_PX}; on short screens (landscape phones) we
 * shrink it so the sheet (capped at {@link SHEET_MAX_VH}svh) doesn't need
 * to scroll just to reveal the footer buttons.
 */
function pickInitialEditorHeight(): number {
  if (typeof window === "undefined") return TEXTAREA_DEFAULT_PX;
  const sheetCapPx = window.innerHeight * (SHEET_MAX_VH / 100);
  const available = sheetCapPx - SHEET_CHROME_PX;
  const minPx = Math.round(TEXTAREA_DEFAULT_PX * TEXTAREA_MIN_RATIO);
  return Math.max(minPx, Math.min(TEXTAREA_DEFAULT_PX, available));
}
