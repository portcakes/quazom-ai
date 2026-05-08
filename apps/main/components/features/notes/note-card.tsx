"use client";

import { useState } from "react";
import { BookIcon, GraduationCapIcon } from "lucide-react";
import Link from "next/link";
import { NoteEditorDialog, type NoteForEdit } from "./note-editor-dialog";

export type NoteCardData = {
  id: string;
  title: string | null;
  content: string;
  lessonId: string | null;
  curriculumId: string | null;
  updatedAt: Date | string;
  lesson: { id: string; title: string; curriculumId: string } | null;
  curriculum: { id: string; title: string } | null;
};

type Props = {
  note: NoteCardData;
};

export function NoteCard({ note }: Props) {
  const [open, setOpen] = useState(false);
  const updated =
    typeof note.updatedAt === "string" ? new Date(note.updatedAt) : note.updatedAt;

  const editNote: NoteForEdit = {
    id: note.id,
    title: note.title,
    content: note.content,
    lessonId: note.lessonId,
    curriculumId: note.curriculumId,
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex h-full min-w-0 flex-col items-stretch gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-sidebar-accent/40 hover:ring-1 hover:ring-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 break-words font-heading text-base font-semibold leading-snug">
            {note.title?.trim() || "Untitled note"}
          </h3>
          <time
            dateTime={updated.toISOString()}
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
            title={updated.toLocaleString()}
          >
            {formatRelative(updated)}
          </time>
        </div>
        <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {note.content}
        </p>
        {(note.curriculum || note.lesson) && (
          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2 text-xs text-muted-foreground">
            {note.curriculum ? (
              <ContextChip
                href={`/curricula/${note.curriculum.id}`}
                icon={<GraduationCapIcon className="size-3" />}
              >
                {note.curriculum.title}
              </ContextChip>
            ) : null}
            {note.lesson ? (
              <ContextChip
                href={`/lessons/${note.lesson.id}`}
                icon={<BookIcon className="size-3" />}
              >
                {note.lesson.title}
              </ContextChip>
            ) : null}
          </div>
        )}
      </button>
      <NoteEditorDialog open={open} onOpenChange={setOpen} note={editNote} />
    </>
  );
}

function ContextChip({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className="flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 hover:bg-muted"
    >
      {icon}
      <span className="truncate">{children}</span>
    </Link>
  );
}

const RELATIVE_DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.345, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

function formatRelative(date: Date): string {
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  let duration = (date.getTime() - Date.now()) / 1000;
  for (const div of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < div.amount) {
      return formatter.format(Math.round(duration), div.unit);
    }
    duration /= div.amount;
  }
  return date.toLocaleDateString();
}
