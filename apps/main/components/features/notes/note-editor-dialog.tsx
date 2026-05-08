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
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Label } from "@quazom-ai/ui/components/ui/label";
import { Textarea } from "@quazom-ai/ui/components/ui/textarea";
import { useTRPC } from "@/trpc/client";
import { NOTE_MAX_LENGTH } from "@/inngest/schemas";

export type NoteForEdit = {
  id: string;
  title: string | null;
  content: string;
  lessonId?: string | null;
  curriculumId?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When editing an existing note: pass `note`. When creating: pass scope hints.
  note?: NoteForEdit | null;
  defaultLessonId?: string | null;
  defaultCurriculumId?: string | null;
  // Optional callback after a successful save/delete so parents can react.
  onSaved?: (id: string) => void;
  onDeleted?: (id: string) => void;
};

export function NoteEditorDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {/* Re-mount the form whenever a different note (or a new-note context)
            is opened so its useState initializers run fresh. This avoids the
            React 19 set-state-in-effect anti-pattern. */}
        {props.open ? (
          <NoteForm key={props.note?.id ?? "new"} {...props} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function NoteForm({
  onOpenChange,
  note,
  defaultLessonId,
  defaultCurriculumId,
  onSaved,
  onDeleted,
}: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.listNotes.pathKey() });

  const create = useMutation(
    trpc.createNote.mutationOptions({
      onSuccess: (n) => {
        toast.success("Note saved");
        void invalidate();
        onSaved?.(n.id);
        onOpenChange(false);
      },
      onError: (err) => toast.error(err.message ?? "Failed to save note"),
    }),
  );

  const update = useMutation(
    trpc.updateNote.mutationOptions({
      onSuccess: () => {
        toast.success("Note updated");
        void invalidate();
        if (note) onSaved?.(note.id);
        onOpenChange(false);
      },
      onError: (err) => toast.error(err.message ?? "Failed to update note"),
    }),
  );

  const remove = useMutation(
    trpc.deleteNote.mutationOptions({
      onSuccess: () => {
        toast.success("Note deleted");
        void invalidate();
        if (note) onDeleted?.(note.id);
        onOpenChange(false);
      },
      onError: (err) => toast.error(err.message ?? "Failed to delete note"),
    }),
  );

  const isEditing = Boolean(note);
  const isPending = create.isPending || update.isPending || remove.isPending;
  const trimmed = content.trim();
  const overLimit = trimmed.length > NOTE_MAX_LENGTH;
  const empty = trimmed.length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (empty || overLimit) return;
    if (isEditing && note) {
      update.mutate({ id: note.id, title: title.trim() || null, content });
    } else {
      create.mutate({
        title: title.trim() || undefined,
        content,
        lessonId: defaultLessonId ?? undefined,
        curriculumId: defaultCurriculumId ?? undefined,
      });
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit note" : "New note"}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Update your note. Changes save when you click Save."
            : "Capture a thought, observation, or question."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="note-title">Title (optional)</Label>
          <Input
            id="note-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Add a short title…"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="note-content">Note</Label>
          <Textarea
            id="note-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note…"
            className="min-h-[200px]"
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
        <DialogFooter className="flex flex-row items-center justify-between gap-2 sm:justify-between">
          {isEditing && note ? (
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-destructive hover:text-destructive"
              disabled={isPending}
              onClick={() => remove.mutate({ id: note.id })}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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
              {isEditing ? "Save" : "Create"}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </>
  );
}
