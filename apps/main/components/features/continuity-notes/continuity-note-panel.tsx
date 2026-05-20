"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2Icon,
  TrashIcon,
  XIcon,
  DownloadIcon,
  CheckIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@quazom-ai/ui/components/ui/alert-dialog";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { cn } from "@quazom-ai/ui/lib/utils";
import { useTRPC } from "@/trpc/client";
import { RichTextEditor } from "./rich-text-editor";
import { useContinuityNotes } from "./continuity-note-provider";
import { downloadContinuityNoteAsPdf } from "./continuity-note-pdf";

const SAVE_DEBOUNCE_MS = 700;

/**
 * Right-hand split-screen panel that hosts the rich-text editor for the
 * currently-open Continuity Note. Renders nothing when no note is active.
 *
 * On md+ screens the panel sits next to the main content as a fixed-width
 * column (width: 480px). On smaller viewports it covers the whole page so
 * the editor remains usable on phones.
 */
export function ContinuityNotePanel() {
  const { activeNoteId, isOpen, closeEditor, deleteNote } = useContinuityNotes();

  if (!isOpen || !activeNoteId) return null;

  return (
    <aside
      className={cn(
        // Mobile: full-viewport overlay so the editor stays usable on phones.
        "fixed inset-0 z-40 flex flex-col bg-background",
        // md+: sticky to the top of the viewport so the panel's header,
        // title input, and editor toolbar remain visible while the page on
        // the left continues to scroll. `self-start` opts the panel out of
        // the flex container's default stretch so its height is exactly
        // the viewport (h-svh) rather than the parent's full height —
        // sticky positioning requires a constrained height to "stick".
        "md:sticky md:top-0 md:z-auto md:h-svh md:self-start md:w-[480px] md:shrink-0 md:border-l md:border-border",
      )}
      aria-label="Continuity Note editor"
    >
      {/* `key` resets every piece of local state when the user switches
          notes — that's what frees us from manually re-hydrating
          title/content out of a useEffect. */}
      <ContinuityNotePanelBody
        key={activeNoteId}
        noteId={activeNoteId}
        onClose={closeEditor}
        onDelete={async () => {
          await deleteNote(activeNoteId);
        }}
      />
    </aside>
  );
}

function ContinuityNotePanelBody({
  noteId,
  onClose,
  onDelete,
}: {
  noteId: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const noteQuery = useQuery(
    trpc.getContinuityNote.queryOptions({ id: noteId }),
  );

  // The body uses the "adjusting state based on a derived value during
  // render" pattern instead of a hydration useEffect: when the server
  // payload first lands, we copy it into local state once, then the local
  // state is the source of truth (the autosave below pushes changes back).
  const [hydrated, setHydrated] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  if (!hydrated && noteQuery.data) {
    setHydrated(true);
    setTitle(noteQuery.data.title ?? "");
    setContent(noteQuery.data.content ?? "");
  }

  // `savedSnapshot` mirrors what we last successfully wrote to the server.
  // We update it inside the mutation's onSuccess callback (no setState in
  // an effect required) so the dirty calculation below can be a pure
  // derivation rather than a stateful flag.
  const [savedSnapshot, setSavedSnapshot] = useState<{
    title: string;
    content: string;
  } | null>(null);
  if (
    savedSnapshot === null &&
    hydrated &&
    noteQuery.data
  ) {
    setSavedSnapshot({
      title: noteQuery.data.title ?? "",
      content: noteQuery.data.content ?? "",
    });
  }

  const updateMutation = useMutation(
    trpc.updateContinuityNote.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.listContinuityNotes.queryKey(),
        });
        // Snapshot the values we just shipped so future renders read the
        // editor as "saved". Stored via setState in a callback, not an
        // effect, which the new lint rule permits.
        setSavedSnapshot({ title: title.trim(), content });
      },
      onError: (err) => {
        toast.error(err.message ?? "Couldn't save note");
      },
    }),
  );

  // Pure derivation of the save indicator state from local edits vs the
  // last snapshot we successfully wrote.
  const dirty =
    savedSnapshot !== null &&
    (savedSnapshot.title !== title.trim() ||
      savedSnapshot.content !== content);

  // Debounced auto-save: each keystroke schedules a write 700ms out, and
  // any new keystroke resets that timer. The mutation only fires when the
  // local state actually differs from the last saved snapshot, so an
  // immediate re-render after a successful save can't trigger a redundant
  // PATCH. No setState calls live inside this effect.
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated || !savedSnapshot) return;
    if (!dirty) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateMutation.mutate({
        id: noteId,
        title: title.trim() || null,
        content,
      });
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, hydrated, noteId, dirty]);

  // Flush any pending save when the editor closes so the user doesn't lose
  // the last keystrokes before unmount.
  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (!hydrated || !dirty) return;
    updateMutation.mutate({
      id: noteId,
      title: title.trim() || null,
      content,
    });
  }, [hydrated, dirty, title, content, noteId, updateMutation]);

  const handleClose = () => {
    flushSave();
    onClose();
  };

  const handleExportPdf = () => {
    downloadContinuityNoteAsPdf({
      title: title.trim() || "Untitled note",
      html: content,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Continuity Note
        </span>
        <div className="flex items-center gap-1">
          <SaveIndicator saving={updateMutation.isPending} dirty={dirty} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleExportPdf}
            className="gap-1 text-xs"
            title="Export as PDF"
          >
            <DownloadIcon className="size-3.5" />
            PDF
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-destructive hover:text-destructive"
                title="Delete note"
              >
                <TrashIcon className="size-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the note and every link inside it.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    await onDelete();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="gap-1"
            aria-label="Close note"
            title="Close"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-1 min-h-0 flex-col gap-3 px-4 py-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled note"
          className="border-0 bg-transparent px-0 font-heading text-2xl font-bold tracking-tight shadow-none focus-visible:ring-0 focus-visible:border-0"
        />
        {noteQuery.isLoading || !hydrated ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" />
          </div>
        ) : (
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Start writing your note. Use the toolbar to format, add highlights, or insert links back to your courses, lessons, and resources."
          />
        )}
      </div>
    </div>
  );
}

function SaveIndicator({
  saving,
  dirty,
}: {
  saving: boolean;
  dirty: boolean;
}) {
  if (saving) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2Icon className="size-3 animate-spin" />
        Saving…
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="text-[11px] text-muted-foreground">Unsaved…</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <CheckIcon className="size-3" />
      Saved
    </span>
  );
}
