"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookIcon,
  GraduationCapIcon,
  LibraryIcon,
  PencilIcon,
  SaveIcon,
  SparklesIcon,
  TagIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Label } from "@quazom-ai/ui/components/ui/label";
import { cn } from "@quazom-ai/ui/lib/utils";
import { useTRPC } from "@/trpc/client";
import {
  NOTE_DESCRIPTION_MAX_LENGTH,
  NOTE_MAX_LENGTH,
} from "@/inngest/schemas";
import type { NoteDetail } from "@/lib/queries/notes";
import { Markdown } from "@/components/shared/markdown";
import { MarkdownEditor } from "./markdown-editor";
import { NoteTagsInput } from "./note-tags-input";

type Props = {
  initialNote: NoteDetail;
};

const COLLAPSE_TRIGGER_PX = 96;

export function NoteView({ initialNote }: Props) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [note, setNote] = useState(initialNote);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(initialNote.title ?? "");
  const [draftDescription, setDraftDescription] = useState(
    initialNote.description ?? "",
  );
  const [draftContent, setDraftContent] = useState(initialNote.content);
  const [draftTags, setDraftTags] = useState<string[]>(initialNote.tags ?? []);
  const [showTagsEditor, setShowTagsEditor] = useState(
    (initialNote.tags ?? []).length > 0,
  );

  const heroRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setCollapsed(!entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: `-${COLLAPSE_TRIGGER_PX}px 0px 0px 0px`,
      },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const update = useMutation(
    trpc.updateNote.mutationOptions({
      onSuccess: () => {
        toast.success("Note saved");
        setNote((prev) => ({
          ...prev,
          title: draftTitle.trim() || null,
          description: draftDescription.trim() || null,
          content: draftContent,
          tags: draftTags,
          updatedAt: new Date(),
        }));
        setEditing(false);
        void queryClient.invalidateQueries({
          queryKey: trpc.listNotes.pathKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.getNote.pathKey(),
        });
      },
      onError: (err) => toast.error(err.message ?? "Failed to save note"),
    }),
  );

  const remove = useMutation(
    trpc.deleteNote.mutationOptions({
      onSuccess: () => {
        toast.success("Note deleted");
        void queryClient.invalidateQueries({
          queryKey: trpc.listNotes.pathKey(),
        });
        // Try to navigate to the previous note; otherwise go to /notes.
        if (note.prevId) {
          router.replace(`/notes/${note.prevId}`);
        } else if (note.nextId) {
          router.replace(`/notes/${note.nextId}`);
        } else {
          router.replace("/notes");
        }
      },
      onError: (err) => toast.error(err.message ?? "Failed to delete note"),
    }),
  );

  const summarize = useMutation(
    trpc.summarizeNote.mutationOptions({
      onSuccess: (data) => {
        if (editing) {
          setDraftTitle(data.title);
          setDraftDescription(data.description);
        } else {
          setDraftTitle(data.title);
          setDraftDescription(data.description);
          // Persist immediately when not in edit mode.
          update.mutate({
            id: note.id,
            title: data.title,
            description: data.description,
          });
        }
        toast.success("Summary generated");
      },
      onError: (err) => toast.error(err.message ?? "Failed to summarize"),
    }),
  );

  const startEdit = () => {
    setDraftTitle(note.title ?? "");
    setDraftDescription(note.description ?? "");
    setDraftContent(note.content);
    setDraftTags(note.tags ?? []);
    setShowTagsEditor((note.tags ?? []).length > 0);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraftTitle(note.title ?? "");
    setDraftDescription(note.description ?? "");
    setDraftContent(note.content);
    setDraftTags(note.tags ?? []);
  };

  const trimmedContent = draftContent.trim();
  const overLimit = trimmedContent.length > NOTE_MAX_LENGTH;
  const empty = trimmedContent.length === 0;
  const isSaving = update.isPending;

  const handleSave = () => {
    if (empty || overLimit) return;
    update.mutate({
      id: note.id,
      title: draftTitle.trim() || null,
      description: draftDescription.trim() || null,
      content: draftContent,
      tags: draftTags,
    });
  };

  const titleText = note.title?.trim() || "Untitled note";

  return (
    <div className="flex min-w-0 flex-col">
      {/* Sticky compact header — appears once the user scrolls past the hero. */}
      <div className="sticky top-12 z-20 h-0 md:top-0">
        <div
          aria-hidden={!collapsed}
          className={cn(
            "absolute inset-x-0 top-0 flex h-12 items-center border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
            "transition-opacity duration-150",
            collapsed ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-6">
            <h2 className="min-w-0 truncate font-heading text-base font-semibold tracking-tight">
              {editing ? draftTitle.trim() || "Untitled note" : titleText}
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              {editing ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={cancelEdit}
                    disabled={isSaving}
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSave}
                    disabled={empty || overLimit || isSaving}
                    className="cursor-pointer"
                  >
                    <SaveIcon className="size-4" />
                    {isSaving ? "Saving…" : "Save"}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={startEdit}
                  className="cursor-pointer"
                  disabled={note.isAnnotation}
                >
                  <PencilIcon className="size-4" />
                  Edit note
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <section
        ref={heroRef}
        className="border-b border-border bg-gradient-to-b from-muted/40 to-background"
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-6 py-6 md:gap-4 md:py-10">
          <Link
            href="/notes"
            className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" />
            <span>All notes</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {note.isAnnotation ? (
              <Badge variant="outline" className="capitalize">
                Annotations
              </Badge>
            ) : null}
            {note.curriculum ? (
              <Link
                href={`/curricula/${note.curriculum.id}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs hover:bg-muted"
              >
                <GraduationCapIcon className="size-3" />
                <span className="truncate">{note.curriculum.title}</span>
              </Link>
            ) : null}
            {note.lesson ? (
              <Link
                href={`/lessons/${note.lesson.id}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs hover:bg-muted"
              >
                <BookIcon className="size-3" />
                <span className="truncate">{note.lesson.title}</span>
              </Link>
            ) : null}
            {note.resource ? (
              <Link
                href={`/resources/${note.resource.id}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs hover:bg-muted"
              >
                <LibraryIcon className="size-3" />
                <span className="truncate">{note.resource.title}</span>
              </Link>
            ) : null}
            {!editing && note.tags && note.tags.length > 0 ? (
              <span className="flex flex-wrap items-center gap-1">
                {note.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-[10px] font-normal lowercase"
                  >
                    #{tag}
                  </Badge>
                ))}
              </span>
            ) : null}
          </div>

          {editing ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="note-title-input">Title</Label>
                <Input
                  id="note-title-input"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  maxLength={120}
                  placeholder="Untitled note"
                  className="h-11 text-lg font-heading"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="note-description-input">
                  Description (optional)
                </Label>
                <Input
                  id="note-description-input"
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  maxLength={NOTE_DESCRIPTION_MAX_LENGTH}
                  placeholder="A 1-2 sentence summary…"
                />
              </div>
              <div className="flex flex-col gap-2">
                {showTagsEditor || draftTags.length > 0 ? (
                  <>
                    <Label>Tags</Label>
                    <NoteTagsInput value={draftTags} onChange={setDraftTags} />
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit cursor-pointer text-muted-foreground"
                    onClick={() => setShowTagsEditor(true)}
                  >
                    <TagIcon className="size-3.5" />
                    Add tags
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {titleText}
              </h1>
              {note.description ? (
                <p className="max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  {note.description}
                </p>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer"
              disabled={summarize.isPending || (editing ? empty : false)}
              onClick={() => {
                summarize.mutate({
                  id: note.id,
                  content: editing ? draftContent : note.content,
                });
              }}
            >
              <SparklesIcon className="size-4" />
              {summarize.isPending ? "Summarizing…" : "Summarize my note"}
            </Button>
            {editing ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={cancelEdit}
                  disabled={isSaving}
                  className="cursor-pointer"
                >
                  <XIcon className="size-4" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={empty || overLimit || isSaving}
                  className="cursor-pointer"
                >
                  <SaveIcon className="size-4" />
                  {isSaving ? "Saving…" : "Save changes"}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={startEdit}
                className="cursor-pointer"
                disabled={note.isAnnotation}
                title={
                  note.isAnnotation
                    ? "Annotation notes are auto-generated from your highlights."
                    : undefined
                }
              >
                <PencilIcon className="size-4" />
                Edit note
              </Button>
            )}
            {!editing ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto cursor-pointer text-destructive hover:text-destructive"
                disabled={remove.isPending}
                onClick={() => {
                  if (
                    typeof window !== "undefined" &&
                    !window.confirm("Delete this note? This cannot be undone.")
                  ) {
                    return;
                  }
                  remove.mutate({ id: note.id });
                }}
              >
                <Trash2Icon className="size-4" />
                Delete
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-6 py-8">
        {editing ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="note-content-edit">Note</Label>
            <MarkdownEditor
              value={draftContent}
              onChange={setDraftContent}
              minHeightClass="min-h-[400px]"
            />
            <div className="flex items-center justify-between text-xs">
              <span
                className={
                  overLimit ? "text-destructive" : "text-muted-foreground"
                }
              >
                {trimmedContent.length} / {NOTE_MAX_LENGTH}
              </span>
              {overLimit ? (
                <span className="text-destructive">Note is too long.</span>
              ) : null}
            </div>
          </div>
        ) : (
          <article className="rounded-xl border border-border bg-card/30 p-6">
            <Markdown allowInlineHtml>{note.content}</Markdown>
          </article>
        )}
      </section>

      {/* Prev / Next note navigation */}
      <nav className="mx-auto w-full max-w-4xl px-6 pb-12">
        <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
          <NoteNavLink
            direction="prev"
            href={note.prevId ? `/notes/${note.prevId}` : null}
          />
          <NoteNavLink
            direction="next"
            href={note.nextId ? `/notes/${note.nextId}` : null}
          />
        </div>
      </nav>
    </div>
  );
}

function NoteNavLink({
  direction,
  href,
}: {
  direction: "prev" | "next";
  href: string | null;
}) {
  const label = direction === "prev" ? "Previous note" : "Next note";
  const Icon = direction === "prev" ? ArrowLeftIcon : ArrowRightIcon;
  if (!href) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground/50">
        {direction === "prev" ? <Icon className="size-4" /> : null}
        <span>{label}</span>
        {direction === "next" ? <Icon className="size-4" /> : null}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 rounded-lg border border-border bg-card/40 px-4 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent/40 hover:text-foreground",
      )}
    >
      {direction === "prev" ? (
        <Icon className="size-4 transition-transform group-hover:-translate-x-0.5" />
      ) : null}
      <span>{label}</span>
      {direction === "next" ? (
        <Icon className="size-4 transition-transform group-hover:translate-x-0.5" />
      ) : null}
    </Link>
  );
}
